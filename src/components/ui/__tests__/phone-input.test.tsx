import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhoneInput, formatBrazilPhone, stripBrazilPhone } from "../phone-input";

describe("formatBrazilPhone", () => {
  it("formats empty string as empty", () => {
    expect(formatBrazilPhone("")).toBe("");
  });
  it("formats partial DDD", () => {
    expect(formatBrazilPhone("11")).toBe("(11");
  });
  it("formats landline (10 digits)", () => {
    expect(formatBrazilPhone("1133334444")).toBe("(11) 3333-4444");
  });
  it("formats mobile (11 digits)", () => {
    expect(formatBrazilPhone("11999998888")).toBe("(11) 99999-8888");
  });
  it("strips leading 55 country code on paste", () => {
    expect(formatBrazilPhone("5511999998888")).toBe("(11) 99999-8888");
  });
  it("caps at 11 digits", () => {
    expect(formatBrazilPhone("119999988889999")).toBe("(11) 99999-8888");
  });
});

describe("stripBrazilPhone", () => {
  it("returns only digits", () => {
    expect(stripBrazilPhone("(11) 99999-8888")).toBe("11999998888");
  });
  it("strips leading 55", () => {
    expect(stripBrazilPhone("+55 (11) 99999-8888")).toBe("11999998888");
  });
});

describe("PhoneInput", () => {
  it("renders formatted value from raw digits", () => {
    render(<PhoneInput value="11999998888" onChange={() => {}} />);
    expect(screen.getByDisplayValue("(11) 99999-8888")).toBeInTheDocument();
  });

  it("calls onChange with stripped digits", () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "(11) 99999-8888" } });
    expect(onChange).toHaveBeenCalledWith("11999998888");
  });
});
