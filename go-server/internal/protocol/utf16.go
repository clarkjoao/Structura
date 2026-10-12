package protocol

import (
	"strconv"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// DecodeJSONStringUTF16 decodes a JSON string literal into UTF-16 code units, keeping lone
// surrogates. The browser cuts the seed into chunks at arbitrary UTF-16 offsets, so a chunk may
// end in the first half of a surrogate pair (JSON.stringify writes it as a `\udXXX` escape);
// decoding chunks to UTF-8 one by one would destroy that character.
func DecodeJSONStringUTF16(raw []byte) ([]uint16, bool) {
	s := strings.TrimSpace(string(raw))
	if len(s) < 2 || s[0] != '"' || s[len(s)-1] != '"' {
		return nil, false
	}
	s = s[1 : len(s)-1]
	out := make([]uint16, 0, len(s))
	for i := 0; i < len(s); {
		c := s[i]
		switch {
		case c == '"':
			return nil, false
		case c < 0x20:
			return nil, false
		case c == '\\':
			if i+1 >= len(s) {
				return nil, false
			}
			switch s[i+1] {
			case '"', '\\', '/':
				out = append(out, uint16(s[i+1]))
				i += 2
			case 'b':
				out = append(out, '\b')
				i += 2
			case 'f':
				out = append(out, '\f')
				i += 2
			case 'n':
				out = append(out, '\n')
				i += 2
			case 'r':
				out = append(out, '\r')
				i += 2
			case 't':
				out = append(out, '\t')
				i += 2
			case 'u':
				if i+6 > len(s) {
					return nil, false
				}
				v, err := strconv.ParseUint(s[i+2:i+6], 16, 16)
				if err != nil {
					return nil, false
				}
				out = append(out, uint16(v))
				i += 6
			default:
				return nil, false
			}
		case c < utf8.RuneSelf:
			out = append(out, uint16(c))
			i++
		default:
			r, size := utf8.DecodeRuneInString(s[i:])
			if r >= 0x10000 {
				hi, lo := utf16.EncodeRune(r)
				out = append(out, uint16(hi), uint16(lo))
			} else {
				out = append(out, uint16(r))
			}
			i += size
		}
	}
	return out, true
}

// UTF16ToString turns joined code units back into a Go string. A surrogate still unpaired after
// joining becomes U+FFFD.
func UTF16ToString(units []uint16) string {
	return string(utf16.Decode(units))
}

// ChunkString splits text into chunks of at most size UTF-16 code units, never inside a
// surrogate pair. There is always at least one chunk, possibly empty.
func ChunkString(text string, size int) []string {
	if text == "" {
		return []string{""}
	}
	var chunks []string
	start, units := 0, 0
	for i := 0; i < len(text); {
		r, n := utf8.DecodeRuneInString(text[i:])
		w := 1
		if r >= 0x10000 {
			w = 2
		}
		if units+w > size {
			chunks = append(chunks, text[start:i])
			start, units = i, 0
		}
		units += w
		i += n
	}
	return append(chunks, text[start:])
}
