package scraper

import (
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"syscall"
	"time"
)

var blockedIPNets []*net.IPNet

func init() {
	blockedCIDRs := []string{
		// IPv4
		"0.0.0.0/8",          // This host on this network
		"10.0.0.0/8",          // Private network RFC 1918
		"100.64.0.0/10",       // Shared address space (CGNAT) RFC 6598
		"127.0.0.0/8",         // Loopback
		"169.254.0.0/16",      // Link-local / Cloud metadata (AWS, GCP, Azure, DigitalOcean)
		"172.16.0.0/12",       // Private network RFC 1918
		"192.0.0.0/24",        // IETF protocol assignments
		"192.0.2.0/24",        // TEST-NET-1 documentation
		"192.168.0.0/16",      // Private network RFC 1918
		"198.18.0.0/15",       // Network benchmark tests
		"198.51.100.0/24",     // TEST-NET-2 documentation
		"203.0.113.0/24",      // TEST-NET-3 documentation
		"224.0.0.0/4",         // Multicast
		"240.0.0.0/4",         // Reserved for future use
		"255.255.255.255/32",  // Broadcast

		// IPv6
		"::/128",              // Unspecified
		"::1/128",             // Loopback
		"::ffff:0:0/96",       // IPv4-mapped IPv6
		"64:ff9b::/96",        // IPv4-IPv6 translation
		"100::/64",            // Discard prefix
		"2001::/23",           // IETF protocol assignments
		"2001:db8::/32",       // Documentation
		"fc00::/7",            // Unique Local Address (ULA) RFC 4193
		"fe80::/10",           // Link-local unicast
		"ff00::/8",            // Multicast
	}

	for _, cidr := range blockedCIDRs {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err == nil {
			blockedIPNets = append(blockedIPNets, ipNet)
		}
	}
}

func ValidateURLSafety(rawURL string) (*url.URL, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return nil, fmt.Errorf("URL cannot be empty")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("invalid URL format: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return nil, fmt.Errorf("URL scheme '%s' not allowed (only http and https are accepted)", parsed.Scheme)
	}

	hostname := parsed.Hostname()
	if hostname == "" {
		return nil, fmt.Errorf("missing URL hostname")
	}

	lowerHost := strings.ToLower(strings.Trim(hostname, "[]."))
	if lowerHost == "localhost" ||
		lowerHost == "localhost.localdomain" ||
		strings.HasSuffix(lowerHost, ".localhost") ||
		strings.HasSuffix(lowerHost, ".local") ||
		strings.HasSuffix(lowerHost, ".internal") {
		return nil, fmt.Errorf("local host access blocked (Anti-SSRF): %s", hostname)
	}

	// Se o hostname já for um IP literal
	if ip := net.ParseIP(hostname); ip != nil {
		if err := EnsurePublicIP(ip); err != nil {
			return nil, err
		}
	}

	return parsed, nil
}

func EnsurePublicIP(ip net.IP) error {
	if ip == nil {
		return fmt.Errorf("nil IP address")
	}

	// Desencapsula IPv4 mapeado em IPv6 (::ffff:192.0.2.1)
	if v4 := ip.To4(); v4 != nil {
		ip = v4
	}

	if ip.IsUnspecified() {
		return fmt.Errorf("unspecified IP address blocked (Anti-SSRF): %s", ip.String())
	}
	if ip.IsLoopback() {
		return fmt.Errorf("loopback IP address blocked (Anti-SSRF): %s", ip.String())
	}
	if ip.IsPrivate() {
		return fmt.Errorf("private network IP address blocked (Anti-SSRF): %s", ip.String())
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return fmt.Errorf("link-local IP address blocked (Anti-SSRF): %s", ip.String())
	}
	if ip.IsMulticast() {
		return fmt.Errorf("multicast IP address blocked (Anti-SSRF): %s", ip.String())
	}

	for _, blocked := range blockedIPNets {
		if blocked.Contains(ip) {
			return fmt.Errorf("reserved/restricted IP address blocked (Anti-SSRF): %s in %s", ip.String(), blocked.String())
		}
	}

	return nil
}

// NewSafeHTTPClient cria um http.Client protegido contra SSRF e DNS rebinding
func NewSafeHTTPClient(timeout time.Duration) *http.Client {
	dialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 30 * time.Second,
		Control: func(network, address string, c syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				host = address
			}
			ip := net.ParseIP(host)
			if ip != nil {
				return EnsurePublicIP(ip)
			}
			return nil
		},
	}

	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		DialContext:           dialer.DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	client := &http.Client{
		Transport: transport,
		Timeout:   timeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("stopped after 5 redirects")
			}
			// Valida a URL de redirecionamento contra SSRF
			if _, err := ValidateURLSafety(req.URL.String()); err != nil {
				return fmt.Errorf("redirect blocked by Anti-SSRF: %w", err)
			}
			return nil
		},
	}

	return client
}
