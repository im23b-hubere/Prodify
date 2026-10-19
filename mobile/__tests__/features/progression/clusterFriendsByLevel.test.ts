import {
  clusterFriendsByLevel,
  type FriendProgressionEntryDto,
} from "../../../features/progression/clusterFriendsByLevel";

function friend(
  userId: number,
  level: number,
  username = `user${userId}`,
): FriendProgressionEntryDto {
  return {
    user_id: userId,
    username,
    profile_picture_url: null,
    level,
  };
}

describe("clusterFriendsByLevel", () => {
  it("returns empty list for no friends", () => {
    expect(clusterFriendsByLevel([])).toEqual([]);
  });

  it("places a single friend alone on their level", () => {
    expect(clusterFriendsByLevel([friend(1, 5)])).toEqual([
      {
        level: 5,
        visible: [friend(1, 5)],
        overflowCount: 0,
        all: [friend(1, 5)],
      },
    ]);
  });

  it("stacks up to three friends on the same level without overflow badge", () => {
    const friends = [friend(1, 4), friend(2, 4), friend(3, 4)];
    const [cluster] = clusterFriendsByLevel(friends);
    expect(cluster.level).toBe(4);
    expect(cluster.visible).toHaveLength(3);
    expect(cluster.overflowCount).toBe(0);
    expect(cluster.all).toHaveLength(3);
  });

  it("keeps three visible and reports +N overflow beyond three", () => {
    const friends = [friend(1, 8), friend(2, 8), friend(3, 8), friend(4, 8), friend(5, 8)];
    const [cluster] = clusterFriendsByLevel(friends);
    expect(cluster.visible).toHaveLength(3);
    expect(cluster.overflowCount).toBe(2);
    expect(cluster.all).toHaveLength(5);
  });

  it("groups different levels into separate clusters sorted by level", () => {
    const friends = [friend(1, 10), friend(2, 3), friend(3, 10)];
    const clusters = clusterFriendsByLevel(friends);
    expect(clusters.map((c) => c.level)).toEqual([3, 10]);
    expect(clusters[0].all).toHaveLength(1);
    expect(clusters[1].all).toHaveLength(2);
    expect(clusters[1].overflowCount).toBe(0);
  });

  it("ignores invalid levels outside the catalog", () => {
    expect(clusterFriendsByLevel([friend(1, 0), friend(2, 21)])).toEqual([]);
  });

  it("excludes the viewer so you never appear as a friend marker", () => {
    const clusters = clusterFriendsByLevel(
      [friend(9, 7, "me"), friend(2, 7, "pal")],
      { excludeUserId: 9 },
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].all.map((f) => f.user_id)).toEqual([2]);
  });
});
