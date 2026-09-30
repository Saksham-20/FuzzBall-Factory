import { describe, expect, it } from "vitest";
import imageLoader from "./image-loader";

describe("image loader", () => {
  it("lets Cloudinary resize and pick the format", () => {
    expect(imageLoader({ src: "https://res.cloudinary.com/demo/image/upload/v12/fuzz/bear.jpg", width: 640 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_640,c_limit/v12/fuzz/bear.jpg",
    );
  });

  it("passes an explicit quality on to Cloudinary", () => {
    expect(imageLoader({ src: "https://res.cloudinary.com/demo/image/upload/bear.jpg", width: 96, quality: 60 })).toContain("q_60");
  });

  it("leaves a Cloudinary URL that already has a transformation alone", () => {
    const src = "https://res.cloudinary.com/demo/image/upload/w_400,c_fill/bear.jpg";
    expect(imageLoader({ src, width: 640 })).toBe(src);
  });

  it("sends everything else through Next's optimiser", () => {
    expect(imageLoader({ src: "/samples/bag.jpg", width: 828 })).toBe("/_next/image?url=%2Fsamples%2Fbag.jpg&w=828&q=75");
    expect(imageLoader({ src: "https://api.example.com/uploads/a.webp", width: 384, quality: 80 })).toBe(
      "/_next/image?url=https%3A%2F%2Fapi.example.com%2Fuploads%2Fa.webp&w=384&q=80",
    );
  });
});
