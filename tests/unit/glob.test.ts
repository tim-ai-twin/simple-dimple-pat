import { describe, it, expect } from "vitest";
import { matchGlob, matchAnyGlob } from "../../src/lib/glob";

describe("matchGlob", () => {
  it("* matches any string", () => {
    expect(matchGlob("*", "anything")).toBe(true);
    expect(matchGlob("*", "")).toBe(true);
    expect(matchGlob("*", "hello world")).toBe(true);
  });

  it("? matches exactly one character", () => {
    expect(matchGlob("?", "a")).toBe(true);
    expect(matchGlob("?", "")).toBe(false);
    expect(matchGlob("?", "ab")).toBe(false);
  });

  it("my-org-* matches my-org-foo but not other-org", () => {
    expect(matchGlob("my-org-*", "my-org-foo")).toBe(true);
    expect(matchGlob("my-org-*", "other-org")).toBe(false);
  });

  it("test? matches test1 but not test12", () => {
    expect(matchGlob("test?", "test1")).toBe(true);
    expect(matchGlob("test?", "test12")).toBe(false);
  });

  it("*-prod matches app-prod but not app-staging", () => {
    expect(matchGlob("*-prod", "app-prod")).toBe(true);
    expect(matchGlob("*-prod", "app-staging")).toBe(false);
  });

  it("literal string matches exactly", () => {
    expect(matchGlob("hello", "hello")).toBe(true);
    expect(matchGlob("hello", "world")).toBe(false);
    expect(matchGlob("hello", "hello!")).toBe(false);
  });

  it("empty pattern matches empty string only", () => {
    expect(matchGlob("", "")).toBe(true);
    expect(matchGlob("", "something")).toBe(false);
  });

  it("patterns with special regex chars are handled safely", () => {
    expect(matchGlob("file.txt", "file.txt")).toBe(true);
    expect(matchGlob("file.txt", "fileXtxt")).toBe(false);

    expect(matchGlob("a+b", "a+b")).toBe(true);
    expect(matchGlob("a+b", "aab")).toBe(false);

    expect(matchGlob("(test)", "(test)")).toBe(true);
    expect(matchGlob("[bracket]", "[bracket]")).toBe(true);
    expect(matchGlob("a^b$c", "a^b$c")).toBe(true);
    expect(matchGlob("a|b", "a|b")).toBe(true);
    expect(matchGlob("a{b}", "a{b}")).toBe(true);
    expect(matchGlob("a\\b", "a\\b")).toBe(true);
  });
});

describe("matchAnyGlob", () => {
  it("returns true when any pattern matches", () => {
    expect(matchAnyGlob(["foo", "bar", "baz"], "bar")).toBe(true);
    expect(matchAnyGlob(["app-*", "svc-*"], "app-web")).toBe(true);
    expect(matchAnyGlob(["app-*", "svc-*"], "svc-api")).toBe(true);
  });

  it("returns false when no pattern matches", () => {
    expect(matchAnyGlob(["foo", "bar"], "baz")).toBe(false);
    expect(matchAnyGlob(["app-*"], "svc-api")).toBe(false);
  });

  it("empty array returns true (unconstrained)", () => {
    expect(matchAnyGlob([], "anything")).toBe(true);
  });
});
