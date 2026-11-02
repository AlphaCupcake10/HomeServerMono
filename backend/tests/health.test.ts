import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("Health endpoints", () => {
  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("GET /not-a-route returns 404 envelope", async () => {
    const res = await request(app).get("/not-a-route");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe("Request handling", () => {
  it("returns 400 for malformed JSON instead of 500", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 413 for oversized bodies", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a@b.co", password: "x".repeat(20_000) });
    expect(res.status).toBe(413);
  });

  it("does not send upgrade-insecure-requests in the CSP", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["content-security-policy"]).not.toContain("upgrade-insecure-requests");
  });
});
