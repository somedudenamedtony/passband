// D17: reminders without a server. A pass becomes a calendar event with an alarm at AOS − 5 min,
// so the phone's own calendar does the reminding — on iOS and Android, offline.

export interface PassEvent {
  uid: string;
  start: number;
  end: number;
  summary: string;
  description: string;
}

function stamp(t: number): string {
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** RFC 5545 §3.3.11 text escaping. */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const enc = new TextEncoder();

/** RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space. */
function fold(line: string): string {
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    // Continuation lines start with a space, which counts toward their 75.
    if (curLen + len > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function toIcs(events: readonly PassEvent[], createdAt: number, alarmMinutes = 5): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Passband//Satellite passes//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(createdAt)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.summary)}`,
      `TRIGGER:-PT${alarmMinutes}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
