package botua

import "testing"

func TestIsBot(t *testing.T) {
	t.Parallel()
	tests := []struct {
		ua   string
		want bool
	}{
		{"", false},
		{"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0", false},
		{"curl/7.85.0", true},
		{"facebookexternalhit/1.1", true},
		{"GPTBot/1.0", true},
	}
	for _, tc := range tests {
		tc := tc
		t.Run(tc.ua, func(t *testing.T) {
			t.Parallel()
			if got := IsBot(tc.ua); got != tc.want {
				t.Errorf("IsBot(%q)=%v, want %v", tc.ua, got, tc.want)
			}
		})
	}
}
