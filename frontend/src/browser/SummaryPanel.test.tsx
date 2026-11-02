import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SummaryPanel, summarySections } from "./SummaryPanel";

describe("summary presentation", () => {
  it("keeps section boundaries and multiple employers separate", () => {
    const summary = "## EXPERIENCE\n- Acme: Built caching.\n- Metro: Analyzed data.\n\n## PROJECTS\n- Atlas: Achieved 150× speedup.";
    const html = renderToStaticMarkup(<SummaryPanel summary={summary} filename="Example.txt" />);
    expect(summarySections(summary)).toHaveLength(2);
    expect(html.match(/<ul>/g)).toHaveLength(2);
    expect(html).toContain('class="summary-context">Acme</strong>');
    expect(html).toContain('class="summary-context">Metro</strong>');
    expect(html).toContain("Copy summary");
  });

  it("preserves old plain-text summaries without inventing attribution", () => {
    const html = renderToStaticMarkup(<SummaryPanel summary="First fact. Second fact." filename="Old.txt" />);
    expect(html).toContain("First fact. Second fact.");
    expect(html).not.toContain('class="summary-context"');
  });

  it("escapes source HTML and hides processing detail behind disclosure", () => {
    const html = renderToStaticMarkup(<SummaryPanel summary={"## Results\n- <script>alert(1)</script>"} filename="Test.txt" receipt={{ worker_id: "test" }} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<details");
  });
});
