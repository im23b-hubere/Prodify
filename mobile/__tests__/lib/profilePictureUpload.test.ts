import { describe, expect, it, jest } from "@jest/globals";

import {
  buildProfilePictureFormData,
  resolveProfilePictureFileName,
  resolveProfilePictureMime,
} from "../../lib/profilePictureUpload";

jest.mock("expo-file-system", () => ({
  File: class MockExpoFile extends Blob {
    uri: string;
    constructor(uri: string) {
      super();
      this.uri = uri;
    }
  },
}));

describe("profilePictureUpload helpers", () => {
  it("normalizes jpeg mime aliases", () => {
    expect(resolveProfilePictureMime({ uri: "file://a", mimeType: "image/jpg" })).toBe(
      "image/jpeg",
    );
  });

  it("infers mime from file name when mime is missing", () => {
    expect(resolveProfilePictureMime({ uri: "file://a", fileName: "avatar.png" })).toBe(
      "image/png",
    );
  });

  it("falls back to jpeg when nothing is known", () => {
    expect(resolveProfilePictureMime({ uri: "file://a" })).toBe("image/jpeg");
  });

  it("builds a default file name from mime", () => {
    expect(resolveProfilePictureFileName({ uri: "file://a" }, "image/webp")).toBe("profile.webp");
  });

  it("builds FormData with an Expo File part", () => {
    const formData = buildProfilePictureFormData({
      uri: "file:///tmp/avatar.jpg",
      mimeType: "image/jpeg",
      fileName: "avatar.jpg",
    });
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.has("file")).toBe(true);
  });
});
