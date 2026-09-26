#!/usr/bin/env python3
"""Minimal Markdown -> HTML for this project's design doc.
Tables are rendered with inline styles (black text, white background,
black borders) so they paste into Word/other apps with the look intact.
Usage: python3 md_to_html.py input.md output.html
"""
import sys, re, html

TABLE_STYLE = "border-collapse:collapse;border:1px solid #000;margin:12px 0;"
CELL_BASE = ("border:1px solid #000;color:#000;background:#fff;"
             "padding:6px 12px;text-align:left;vertical-align:top;")
TH_STYLE = CELL_BASE + "font-weight:700;"
TD_STYLE = CELL_BASE


import os
_MD_DIR = "."

def inline(text):
    """Escape HTML then apply bold / inline-code markup."""
    text = html.escape(text)
    text = re.sub(r"`([^`]+)`",
                  r'<code style="font-family:monospace;background:#f0f0f0;'
                  r'color:#000;padding:1px 4px;border-radius:3px;">\1</code>',
                  text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    return text


def split_row(line):
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def convert(md):
    lines = md.split("\n")
    out = []
    i = 0
    in_code = False
    code_buf = []
    while i < len(lines):
        line = lines[i]

        # fenced code block
        if line.startswith("```"):
            if in_code:
                out.append('<pre style="background:#f5f5f5;color:#000;border:1px solid'
                           ' #ccc;padding:12px;overflow:auto;font-family:monospace;'
                           'white-space:pre;">' + html.escape("\n".join(code_buf)) + "</pre>")
                code_buf = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue

        # table: a row of |...| followed by a |---| separator
        if line.lstrip().startswith("|") and i + 1 < len(lines) \
                and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
            header = split_row(line)
            i += 2  # skip header + separator
            body = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                body.append(split_row(lines[i]))
                i += 1
            t = [f'<table style="{TABLE_STYLE}">']
            t.append("<thead><tr>" + "".join(
                f'<th style="{TH_STYLE}">{inline(c)}</th>' for c in header
            ) + "</tr></thead>")
            t.append("<tbody>")
            for row in body:
                t.append("<tr>" + "".join(
                    f'<td style="{TD_STYLE}">{inline(c)}</td>' for c in row
                ) + "</tr>")
            t.append("</tbody></table>")
            out.append("\n".join(t))
            continue

        # image: ![alt](src)  — inline SVG files, <img> otherwise
        mi = re.match(r"^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$", line)
        if mi:
            alt, src = mi.group(1), mi.group(2)
            path = os.path.join(_MD_DIR, src)
            if src.lower().endswith(".svg") and os.path.exists(path):
                with open(path, encoding="utf-8") as sf:
                    svg = sf.read()
                svg = re.sub(r'\s(width|height)="[^"]*"', "", svg, count=2)
                out.append('<figure style="margin:16px 0;max-width:100%;overflow:auto;">'
                           f'<div style="max-width:920px;">{svg}</div>'
                           f'<figcaption style="font-size:12px;color:#555;margin-top:6px;">'
                           f'{html.escape(alt)}</figcaption></figure>')
            else:
                out.append(f'<p><img src="{html.escape(src)}" alt="{html.escape(alt)}" '
                           'style="max-width:100%;"></p>')
            i += 1
            continue

        # headings
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>")
            i += 1
            continue

        # horizontal rule
        if re.match(r"^---+\s*$", line):
            out.append('<hr style="border:none;border-top:1px solid #ccc;margin:20px 0;">')
            i += 1
            continue

        # blockquote (possibly multi-line)
        if line.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].startswith(">"):
                buf.append(lines[i][1:].strip())
                i += 1
            out.append('<blockquote style="border-left:3px solid #888;margin:10px 0;'
                       'padding:4px 14px;color:#333;">' +
                       "<br>".join(inline(b) for b in buf) + "</blockquote>")
            continue

        # unordered list
        if re.match(r"^\s*[-*]\s+", line):
            buf = []
            while i < len(lines) and re.match(r"^\s*[-*]\s+", lines[i]):
                buf.append(re.sub(r"^\s*[-*]\s+", "", lines[i]))
                i += 1
            out.append("<ul>" + "".join(f"<li>{inline(b)}</li>" for b in buf) + "</ul>")
            continue

        # ordered list
        if re.match(r"^\s*\d+\.\s+", line):
            buf = []
            while i < len(lines) and re.match(r"^\s*\d+\.\s+", lines[i]):
                buf.append(re.sub(r"^\s*\d+\.\s+", "", lines[i]))
                i += 1
            out.append("<ol>" + "".join(f"<li>{inline(b)}</li>" for b in buf) + "</ol>")
            continue

        # blank line
        if line.strip() == "":
            i += 1
            continue

        # paragraph
        out.append(f"<p>{inline(line)}</p>")
        i += 1

    return "\n".join(out)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    global _MD_DIR
    _MD_DIR = os.path.dirname(os.path.abspath(src))
    with open(src, encoding="utf-8") as f:
        md = f.read()
    body = convert(md)
    doc = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>HDR 效能工作模式 — PQ 策略设计</title>
<style>
  body {{ font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
         color:#111; background:#fff; max-width:1000px; margin:32px auto; padding:0 24px;
         line-height:1.6; }}
  h1,h2,h3,h4 {{ color:#111; }}
  table {{ font-size:14px; }}
  a {{ color:#0645ad; }}
</style></head><body>
{body}
</body></html>"""
    with open(dst, "w", encoding="utf-8") as f:
        f.write(doc)
    print(f"wrote {dst}")


if __name__ == "__main__":
    main()
