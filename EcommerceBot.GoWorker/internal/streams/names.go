package streams

const (
	StreamScrapingProd       = "stream:scraping:prod"
	StreamScrapingDemo       = "stream:scraping:demo"
	StreamAnalyticsML        = "stream:analytics:ml"
	StreamScrapedResults     = "stream:scraped:results"
	StreamAnalyticsProcessed = "stream:analytics:processed"
	StreamDLQ                = "stream:dlq:ecommerce"

	GroupScraper = "go-worker-scraper"
	GroupML      = "go-worker-ml"
)
