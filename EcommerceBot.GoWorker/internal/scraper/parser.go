package scraper

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

type ScrapeResult struct {
	Title              string
	RawDescriptionHTML string
	RawMarkdown        string
	Price              *float64
	Currency           string
	Images             []string
	MetaAttributes     map[string]string
}

type Parser struct {
	client *http.Client
}

func NewParser(timeout time.Duration) *Parser {
	return &Parser{
		client: NewSafeHTTPClient(timeout),
	}
}

func (p *Parser) Parse(ctx context.Context, targetURL string, promptContext string) (*ScrapeResult, error) {
	parsedURL, err := ValidateURLSafety(targetURL)
	if err != nil {
		return nil, fmt.Errorf("anti-ssrf check failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsedURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")
	req.Header.Set("Cache-Control", "no-cache")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return nil, fmt.Errorf("target server returned status %d", resp.StatusCode)
	}

	// Limita leitura a 10MB para proteção contra memory blowup
	limitedReader := io.LimitReader(resp.Body, 10*1024*1024)
	doc, err := goquery.NewDocumentFromReader(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("failed to parse html: %w", err)
	}

	// 1. Extração de JSON-LD
	var jsonLdScripts []string
	doc.Find(`script[type="application/ld+json"]`).Each(func(i int, s *goquery.Selection) {
		jsonLdScripts = append(jsonLdScripts, s.Text())
	})

	productInfo := ExtractJSONLD(jsonLdScripts)

	// 2. Extração via Meta tags / OpenGraph se JSON-LD incompleto
	if productInfo.Title == "" {
		if ogTitle, exists := doc.Find(`meta[property="og:title"]`).Attr("content"); exists && ogTitle != "" {
			productInfo.Title = strings.TrimSpace(ogTitle)
		} else if titleTag := strings.TrimSpace(doc.Find("title").Text()); titleTag != "" {
			productInfo.Title = titleTag
		} else if h1 := strings.TrimSpace(doc.Find("h1").First().Text()); h1 != "" {
			productInfo.Title = h1
		}
	}

	if productInfo.Description == "" {
		if ogDesc, exists := doc.Find(`meta[property="og:description"]`).Attr("content"); exists && ogDesc != "" {
			productInfo.Description = strings.TrimSpace(ogDesc)
		} else if metaDesc, exists := doc.Find(`meta[name="description"]`).Attr("content"); exists && metaDesc != "" {
			productInfo.Description = strings.TrimSpace(metaDesc)
		}
	}

	if len(productInfo.Images) == 0 {
		if ogImg, exists := doc.Find(`meta[property="og:image"]`).Attr("content"); exists && ogImg != "" {
			productInfo.Images = append(productInfo.Images, ogImg)
		}
	}

	if productInfo.Price == nil {
		if ogPrice, exists := doc.Find(`meta[property="product:price:amount"]`).Attr("content"); exists && ogPrice != "" {
			if parsed, err := strconv.ParseFloat(strings.ReplaceAll(ogPrice, ",", "."), 64); err == nil {
				productInfo.Price = &parsed
			}
		}
	}

	// 3. Fallback de Imagens adicionais no DOM
	if len(productInfo.Images) < 3 {
		doc.Find(`img[src]`).Each(func(i int, s *goquery.Selection) {
			if len(productInfo.Images) >= 5 {
				return
			}
			src, exists := s.Attr("src")
			if exists && strings.HasPrefix(src, "http") && !strings.Contains(src, "logo") && !strings.Contains(src, "icon") {
				productInfo.Images = append(productInfo.Images, src)
			}
		})
	}

	// 4. Monta descrição em HTML e Markdown
	rawDescHTML := ""
	if descSel := doc.Find(`#description, .product-description, [itemprop="description"]`).First(); descSel.Length() > 0 {
		rawDescHTML, _ = descSel.Html()
	}
	if rawDescHTML == "" && productInfo.Description != "" {
		rawDescHTML = fmt.Sprintf("<p>%s</p>", productInfo.Description)
	}

	rawMarkdown := productInfo.Description
	if rawMarkdown == "" {
		rawMarkdown = productInfo.Title
	}

	return &ScrapeResult{
		Title:              productInfo.Title,
		RawDescriptionHTML: strings.TrimSpace(rawDescHTML),
		RawMarkdown:        strings.TrimSpace(rawMarkdown),
		Price:              productInfo.Price,
		Currency:           productInfo.Currency,
		Images:             productInfo.Images,
		MetaAttributes:     productInfo.Attributes,
	}, nil
}
