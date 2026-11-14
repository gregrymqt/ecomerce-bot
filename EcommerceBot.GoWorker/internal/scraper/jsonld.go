package scraper

import (
	"encoding/json"
	"strconv"
	"strings"
)

type ParsedProductInfo struct {
	Title       string
	Description string
	Price       *float64
	Currency    string
	Images      []string
	Attributes  map[string]string
}

func ExtractJSONLD(scripts []string) *ParsedProductInfo {
	info := &ParsedProductInfo{
		Currency:   "BRL",
		Images:     make([]string, 0),
		Attributes: make(map[string]string),
	}

	for _, raw := range scripts {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}

		var parsed any
		if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
			continue
		}

		if match := findProductInJSON(parsed); match != nil {
			populateProductFromMap(match, info)
			if info.Title != "" {
				return info
			}
		}
	}

	return info
}

func findProductInJSON(node any) map[string]any {
	switch v := node.(type) {
	case map[string]any:
		typeVal, ok := v["@type"]
		if ok {
			switch t := typeVal.(type) {
			case string:
				if strings.EqualFold(t, "Product") {
					return v
				}
			case []any:
				for _, elem := range t {
					if s, ok := elem.(string); ok && strings.EqualFold(s, "Product") {
						return v
					}
				}
			}
		}

		// Verifica @graph
		if graph, ok := v["@graph"].([]any); ok {
			for _, item := range graph {
				if found := findProductInJSON(item); found != nil {
					return found
				}
			}
		}

	case []any:
		for _, item := range v {
			if found := findProductInJSON(item); found != nil {
				return found
			}
		}
	}

	return nil
}

func populateProductFromMap(m map[string]any, info *ParsedProductInfo) {
	if title, ok := m["name"].(string); ok && title != "" {
		info.Title = strings.TrimSpace(title)
	}

	if desc, ok := m["description"].(string); ok && desc != "" {
		info.Description = strings.TrimSpace(desc)
	}

	if sku, ok := m["sku"].(string); ok && sku != "" {
		info.Attributes["sku"] = sku
	}

	// Brand
	if brand, ok := m["brand"]; ok {
		switch b := brand.(type) {
		case string:
			info.Attributes["brand"] = b
		case map[string]any:
			if name, ok := b["name"].(string); ok {
				info.Attributes["brand"] = name
			}
		}
	}

	// Imagens
	if img, ok := m["image"]; ok {
		extractImages(img, info)
	}

	// Preço via Offers
	if offers, ok := m["offers"]; ok {
		extractOffers(offers, info)
	}
}

func extractImages(img any, info *ParsedProductInfo) {
	seen := make(map[string]bool)
	for _, existing := range info.Images {
		seen[existing] = true
	}

	switch v := img.(type) {
	case string:
		if v != "" && !seen[v] {
			info.Images = append(info.Images, v)
		}
	case []any:
		for _, item := range v {
			if s, ok := item.(string); ok && s != "" && !seen[s] {
				info.Images = append(info.Images, s)
				seen[s] = true
			}
		}
	case map[string]any:
		if urlStr, ok := v["url"].(string); ok && urlStr != "" && !seen[urlStr] {
			info.Images = append(info.Images, urlStr)
		}
	}
}

func extractOffers(offers any, info *ParsedProductInfo) {
	var offerMap map[string]any

	switch v := offers.(type) {
	case map[string]any:
		offerMap = v
	case []any:
		if len(v) > 0 {
			if first, ok := v[0].(map[string]any); ok {
				offerMap = first
			}
		}
	}

	if offerMap == nil {
		return
	}

	if curr, ok := offerMap["priceCurrency"].(string); ok && curr != "" {
		info.Currency = curr
	}

	if priceVal, ok := offerMap["price"]; ok {
		switch p := priceVal.(type) {
		case float64:
			info.Price = &p
		case string:
			clean := strings.ReplaceAll(strings.ReplaceAll(p, ",", "."), " ", "")
			if parsed, err := strconv.ParseFloat(clean, 64); err == nil {
				info.Price = &parsed
			}
		}
	}
}
