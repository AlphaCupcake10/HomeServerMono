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
