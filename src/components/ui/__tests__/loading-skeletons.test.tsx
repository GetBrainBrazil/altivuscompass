import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { KanbanSkeleton, TableSkeleton, ListSkeleton } from "../loading-skeletons";

describe("Loading skeletons", () => {
  it("renders KanbanSkeleton with given columns/cards", () => {
    const { container } = render(<KanbanSkeleton columns={3} cardsPerColumn={2} />);
    // 3 columns headers + 6 card skeletons inside
    expect(container.querySelectorAll(".glass-card").length).toBe(6);
  });

  it("renders TableSkeleton with given row/column count", () => {
    const { container } = render(<TableSkeleton rows={4} columns={3} />);
    // header(3) + 4 rows * 3 = 15 skeleton blocks
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(15);
  });

  it("renders ListSkeleton with given items", () => {
    const { container } = render(<ListSkeleton items={4} />);
    expect(container.querySelectorAll("div.border.rounded-lg").length).toBe(4);
  });
});
