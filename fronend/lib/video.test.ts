import { describe, expect, test } from "bun:test";
import { parseProductVideo } from "./video";

const ID = "dQw4w9WgXcQ";

describe("parseProductVideo — YouTube shapes", () => {
  test("reads the id from every link shape people actually paste", () => {
    const urls = [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
    ];
    for (const url of urls) {
      const got = parseProductVideo(url);
      expect(got).toMatchObject({ kind: "youtube", id: ID });
    }
  });

  test("survives the tracking junk YouTube's share button appends", () => {
    expect(parseProductVideo(`https://www.youtube.com/watch?v=${ID}&t=30s`)).toMatchObject({ id: ID });
    expect(parseProductVideo(`https://youtu.be/${ID}?si=AbCdEf`)).toMatchObject({ id: ID });
    expect(parseProductVideo(`https://www.youtube.com/watch?list=PL123&v=${ID}`)).toMatchObject({ id: ID });
  });

  test("builds a nocookie embed and an hqdefault thumbnail", () => {
    const got = parseProductVideo(`https://youtu.be/${ID}`);
    expect(got).toEqual({
      kind: "youtube",
      id: ID,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ID}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
    });
  });

  test("ids using - and _ are valid", () => {
    const weird = "a-b_c1D2E3F";
    expect(parseProductVideo(`https://youtu.be/${weird}`)).toMatchObject({ kind: "youtube", id: weird });
  });

  /**
   * A YouTube host carrying something that isn't an 11-char id would build an
   * embed URL that 404s inside the iframe. Falling through to `file` at least
   * fails visibly rather than silently showing an empty player.
   */
  test("a YouTube host with a malformed id is not treated as YouTube", () => {
    expect(parseProductVideo("https://www.youtube.com/watch?v=tooshort")).toMatchObject({ kind: "file" });
    expect(parseProductVideo("https://www.youtube.com/watch?v=waaaaaaytoolongforanid")).toMatchObject({ kind: "file" });
    expect(parseProductVideo("https://www.youtube.com/")).toMatchObject({ kind: "file" });
  });
});

describe("parseProductVideo — uploaded files", () => {
  test("a Cloudinary URL is a playable file", () => {
    const url =
      "https://res.cloudinary.com/cum8k5j2/video/upload/f_auto,q_auto/v1785833619/zuptech-prod/product/ips1000/promo.mp4";
    expect(parseProductVideo(url)).toEqual({ kind: "file", url });
  });

  test("any other http(s) URL is treated as a file", () => {
    expect(parseProductVideo("https://cdn.example.com/a.webm")).toMatchObject({ kind: "file" });
  });
});

describe("parseProductVideo — nothing to render", () => {
  test("empty, whitespace and nullish give null", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(parseProductVideo(v)).toBeNull();
    }
  });

  test("unparseable or non-http values give null", () => {
    expect(parseProductVideo("not a url")).toBeNull();
    expect(parseProductVideo("/relative/path.mp4")).toBeNull();
    // javascript: must never reach an href/src.
    expect(parseProductVideo("javascript:alert(1)")).toBeNull();
  });

  test("surrounding whitespace is tolerated", () => {
    expect(parseProductVideo(`  https://youtu.be/${ID}  `)).toMatchObject({ kind: "youtube", id: ID });
  });
});
