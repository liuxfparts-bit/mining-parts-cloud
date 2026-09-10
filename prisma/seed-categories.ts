import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const tree: [string, string, string[], number][] = [
  ["采掘设备配件", "mining-extraction-parts", ["连续采煤机", "掘锚机", "采煤机", "掘进机", "其他"], 1],
  ["铲运/装载设备配件", "loading-hauling-parts", ["支架搬运车", "地下装载机", "铲运机", "装运机", "其他"], 2],
  ["运输设备配件", "transportation-parts", ["梭车", "运输车", "输送机", "皮带运输设备", "其他"], 3],
  ["凿岩/钻机设备配件", "drilling-parts", ["掘进钻机", "凿岩台车", "钻机", "钻杆/钻具", "其他"], 4],
  ["长壁采煤设备配件", "longwall-mining-parts", ["液压支架", "刮板输送机", "采煤机", "转载机", "破碎机", "其他"], 5],
  ["柴油发动机及配件", "diesel-engine-parts", ["发动机总成", "缸体/缸盖", "喷油系统", "冷却系统", "润滑系统", "滤清器", "其他"], 6],
  ["液压系统配件", "hydraulic-parts", ["液压泵", "液压马达", "液压阀", "油缸", "液压管路", "其他"], 7],
  ["电气及控制系统配件", "electrical-control-parts", ["变频器", "电机", "控制器", "传感器", "接触器", "电缆", "熔断器", "其他"], 8],
  ["传动及行走系统配件", "drivetrain-parts", ["变速箱", "减速机", "齿轮", "轴", "联轴器", "轮边/行走机构", "Dana", "其他"], 9],
  ["制动系统配件", "braking-parts", ["制动器", "制动闸块", "制动盘", "制动阀", "其他"], 10],
  ["结构件及机械配件", "mechanical-structural-parts", ["轴承", "轴承座", "销轴", "衬套", "链轮", "结构件", "紧固件", "其他"], 11],
  ["其他矿山设备配件", "other-mining-parts", ["无法确定", "其他"], 12],
];

async function main() {
  let top = 0, sub = 0;
  for (const [name, slugv, children, sort] of tree) {
    const parent = await prisma.category.upsert({
      where: { slug: slugv },
      update: { name, sortOrder: sort },
      create: { name, slug: slugv, sortOrder: sort },
    });
    top++;
    for (let i = 0; i < children.length; i++) {
      const childSlug = `${slugv}/${slug(children[i])}`;
      await prisma.category.upsert({
        where: { slug: childSlug },
        update: { sortOrder: i },
        create: { name: children[i], slug: childSlug, parentId: parent.id, sortOrder: i },
      });
      sub++;
    }
  }
  console.log(`✓ 一级分类: ${top}, 二级分类: ${sub}`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
