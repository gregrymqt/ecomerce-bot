package scraper

import (
	"testing"
)

func TestValidateURLSafety_Allowed(t *testing.T) {
	validURLs := []string{
		"https://example.com/product/123",
		"http://shop.mytestdomain.org/items?sku=abc",
		"https://sub.domain.co.uk/p/watch-rolex",
	}

	for _, u := range validURLs {
		parsed, err := ValidateURLSafety(u)
		if err != nil {
			t.Errorf("expected URL to be allowed, got error: %v for %s", err, u)
		}
		if parsed == nil {
			t.Errorf("expected parsed URL, got nil for %s", u)
		}
	}
}

func TestValidateURLSafety_BlockedSchemes(t *testing.T) {
	blockedURLs := []string{
		"file:///etc/passwd",
		"ftp://files.example.com",
		"gopher://gopher.example.com",
		"javascript:alert(1)",
		"data:text/html,<html>",
	}

	for _, u := range blockedURLs {
		_, err := ValidateURLSafety(u)
		if err == nil {
			t.Errorf("expected scheme error for %s, got nil", u)
		}
	}
}

func TestValidateURLSafety_BlockedHosts(t *testing.T) {
	blockedURLs := []string{
		"http://localhost/admin",
		"http://localhost:8080/metrics",
		"http://myhost.local/status",
		"http://internal.service.internal/debug",
		"http://127.0.0.1:5432",
		"http://127.0.0.2/foo",
		"http://0.0.0.0:8000",
		"http://10.0.0.1/secrets",
		"http://192.168.1.1/router",
		"http://172.16.0.1/vpc",
		"http://169.254.169.254/latest/meta-data/",
		"http://100.64.0.1/cgnat",
		"http://[::1]/admin",
		"http://[::ffff:127.0.0.1]/test",
		"http://[fe80::1]/test",
		"http://[fc00::1]/test",
	}

	for _, u := range blockedURLs {
		_, err := ValidateURLSafety(u)
		if err == nil {
			t.Errorf("expected Anti-SSRF block for %s, got nil", u)
		}
	}
}
