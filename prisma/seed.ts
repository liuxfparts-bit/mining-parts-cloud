import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function main() {
  console.log("🌱 播种矿配云 v3 数据...");

  await prisma.quote.deleteMany();
  await prisma.rFQ.deleteMany();
  await prisma.product.deleteMany();
  await prisma.partNumber.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.supplier.deleteMany();

  // ========== 品牌（10个初始品牌） ==========
  const brandData = [
    { name: "山特维克", nameEn: "Sandvik", country: "瑞典", website: "https://www.rockprocessing.sandvik/", description: "全球领先的矿山凿岩、破碎与掘进设备制造商", seoTitle: "山特维克 Sandvik 矿山设备配件 | 矿配云", seoDescription: "Sandvik MB670-1/LS190/LH517 等设备配件件号查询" },
    { name: "卡特", nameEn: "CAT / Caterpillar", country: "美国", website: "https://www.cat.com/", description: "全球最大工程机械制造商，地下铲运机、矿用卡车", seoTitle: "卡特 CAT 矿山设备配件 | 矿配云", seoDescription: "CAT CL210/R1700G 地下铲运机配件" },
    { name: "小松", nameEn: "Komatsu", country: "日本", website: "https://www.komatsu.com/", description: "全球第二大工程机械制造商，井下自卸车、LHD", seoTitle: "小松 Komatsu 矿山设备配件 | 矿配云", seoDescription: "Komatsu AD30 地下自卸车配件" },
    { name: "久益", nameEn: "JOY / Komatsu Mining", country: "美国", website: "https://www.mining.komatsu/", description: "全球领先的井工采矿设备，连续采煤机、梭车", seoTitle: "久益 JOY 矿山设备配件 | 矿配云", seoDescription: "JOY 10SC32 梭车/12CM15 连续采煤机配件" },
    { name: "艾柯夫", nameEn: "Eickhoff", country: "德国", website: "https://www.eickhoff-bergbau.de/", description: "德国采煤机制造商，长臂工作面采煤机", seoTitle: "艾柯夫 Eickhoff 采煤机配件 | 矿配云", seoDescription: "Eickhoff SL300 采煤机摇臂齿轮箱配件" },
    { name: "康明斯", nameEn: "Cummins", country: "美国", website: "https://www.cummins.com/", description: "全球最大独立发动机制造商，柴油动力系统", seoTitle: "康明斯 Cummins 发动机配件 | 矿配云", seoDescription: "Cummins 发动机滤芯、燃油系统配件" },
    { name: "芬瑞特", nameEn: "FERRIT", country: "斯洛伐克", website: "", description: "矿用诊断仪器与电气控制系统", seoTitle: "芬瑞特 FERRIT 矿用设备配件 | 矿配云", seoDescription: "FERRIT 诊断仪器配件" },
    { name: "德纳", nameEn: "Dana", country: "美国", website: "https://www.dana.com/", description: "全球领先的传动系统、液压系统制造商", seoTitle: "德纳 Dana 传动配件 | 矿配云", seoDescription: "Dana 变速箱、车桥、液压系统配件" },
    { name: "美卓", nameEn: "Metso", country: "芬兰", website: "https://www.metso.com/", description: "全球领先的矿山破碎、筛分设备制造商", seoTitle: "美卓 Metso 矿山设备配件 | 矿配云", seoDescription: "Metso 破碎机、筛分设备配件" },
    { name: "勒图尔勒", nameEn: "LeTourneau", country: "美国", website: "https://www.letourneau.com/", description: "大型地下铲运机与电动轮自卸车制造商", seoTitle: "勒图尔勒 LeTourneau 配件 | 矿配云", seoDescription: "LeTourneau LHD 配件" },
  ];
  const brands: Record<string, any> = {};
  for (const b of brandData) {
    brands[b.name] = await prisma.brand.create({
      data: { ...b, slug: slug(b.nameEn!.split(" ")[0]) },
    });
  }
  console.log(`✓ 品牌: ${brandData.length}`);

  // ========== 设备 ==========
  const equipData = [
    // 山特维克 Sandvik
    { brand: "山特维克", model: "MB670-1", name: "Sandvik MB670-1 锚杆掘进机", nameEn: "Bolter Miner MB670-1", series: "MB 系列", equipmentType: "Bolter Miner", application: "井下锚杆支护与掘进", mineType: "地下金属矿", manufacturer: "Sandvik Mining and Rock Solutions", productionYear: 2018, description: "全断面锚杆钻车/掘进机" },
    { brand: "山特维克", model: "LS190", name: "Sandvik LS190 地下铲运机", nameEn: "Underground LHD LS190", series: "LS 系列", equipmentType: "LHD", application: "井下出矿运输", mineType: "地下金属矿", manufacturer: "Sandvik Mining and Rock Solutions", productionYear: 2019, description: "中型地下铲运机" },
    { brand: "山特维克", model: "LS190S", name: "Sandvik LS190S 地下铲运机", nameEn: "Underground LHD LS190S", series: "LS 系列", equipmentType: "LHD", application: "井下出矿运输", mineType: "地下金属矿", manufacturer: "Sandvik Mining and Rock Solutions", productionYear: 2020, description: "LS190 升级版，加长型铲运机" },
    { brand: "山特维克", model: "LH517", name: "Sandvik LH517 地下铲运机", nameEn: "Underground LHD LH517", series: "LH 系列", equipmentType: "LHD", application: "井下出矿运输", mineType: "地下金属矿", manufacturer: "Sandvik Mining and Rock Solutions", productionYear: 2017, description: "大型地下铲运机" },
    // 卡特 CAT
    { brand: "卡特", model: "CL210", name: "CAT CL210 地下铲运机", nameEn: "Underground LHD CL210", series: "CL 系列", equipmentType: "LHD", application: "井下出矿运输", mineType: "地下金属矿", manufacturer: "Caterpillar Inc.", productionYear: 2016, description: "Underground LHD" },
    { brand: "卡特", model: "R1700G", name: "CAT R1700G 地下铲运机", nameEn: "Underground LHD R1700G", series: "R 系列", equipmentType: "LHD", application: "井下出矿运输", mineType: "地下金属矿", manufacturer: "Caterpillar Inc.", productionYear: 2015, description: "紧凑型地下铲运机" },
    // 久益 JOY
    { brand: "久益", model: "10SC32", name: "JOY 10SC32 梭车", nameEn: "Shuttle Car 10SC32", series: "SC 系列", equipmentType: "Shuttle Car", application: "井工矿煤炭运输", mineType: "井工矿", manufacturer: "Komatsu Mining Corp. (JOY)", productionYear: 2014, description: "井下梭车/铲运车" },
    { brand: "久益", model: "12CM15", name: "JOY 12CM15 连续采煤机", nameEn: "Continuous Miner 12CM15", series: "CM 系列", equipmentType: "Continuous Miner", application: "井工矿巷道掘进", mineType: "井工矿", manufacturer: "Komatsu Mining Corp. (JOY)", productionYear: 2013, description: "连续采煤机" },
    // 小松 Komatsu
    { brand: "小松", model: "AD30", name: "Komatsu AD30 地下自卸车", nameEn: "Underground Truck AD30", series: "AD 系列", equipmentType: "Underground Truck", application: "井下矿石运输", mineType: "地下金属矿", manufacturer: "Komatsu Mining Corp.", productionYear: 2018, description: "铰接式地下自卸车" },
    // 艾柯夫 Eickhoff
    { brand: "艾柯夫", model: "SL300", name: "Eickhoff SL300 采煤机", nameEn: "Shearer Loader SL300", series: "SL 系列", equipmentType: "Shearer", application: "长壁工作面采煤", mineType: "井工矿", manufacturer: "Eickhoff Bergbautechnik GmbH", productionYear: 2019, description: "长臂工作面采煤机" },
  ];
  const equipment: Record<string, any> = {};
  for (const e of equipData) {
    const key = `${e.brand} ${e.model}`;
    equipment[key] = await prisma.equipment.create({
      data: {
        slug: slug(e.model),
        model: e.model,
        name: e.name,
        nameEn: e.nameEn,
        series: e.series,
        equipmentType: e.equipmentType,
        application: e.application,
        mineType: e.mineType,
        manufacturer: e.manufacturer,
        productionYear: e.productionYear,
        description: e.description,
        brandId: brands[e.brand].id,
      },
    });
  }
  console.log(`✓ 设备: ${equipData.length}`);

  // ========== 供应商 ==========
  const supplierData = [
    {
      name: "山西宁东机电设备有限公司", shortName: "宁东机电", slug: "ningdong-jd",
      province: "山西", city: "朔州", address: "朔州开发区机电城",
      contactName: "李总", position: "总经理", mobile: "+86-138-0000-0001", telephone: "0349-0000001",
      email: "sales@ningdong.example", whatsapp: "+86-138-0000-0001", wechat: "ningdong-jd",
      mainBusiness: "井工矿山设备备件国产化、OEM替代及逆向开发",
      mainBrands: "久益 · 小松 · 卡特",
      mainEquipment: "梭车 · 连续采煤机 · 地下铲运机",
      description: "专注 JOY/Komatsu 井工设备备件国产化替代，拥有完整测绘、3D建模、CNC加工能力。",
      verifiedStatus: "VERIFIED", memberLevel: "GOLD",
      responseRate: 95.5, viewCount: 1280, inquiryCount: 45,
    },
    {
      name: "山东矿山装备制造有限公司", shortName: "山东矿装", slug: "sd-kz",
      province: "山东", city: "济宁", address: "济宁高新区",
      contactName: "王经理", position: "销售经理", mobile: "+86-139-0000-0002",
      mainBusiness: "采煤设备配件制造与供应",
      mainBrands: "久益 · 小松",
      mainEquipment: "采煤机 · 梭车",
      description: "山东济宁专业矿山装备制造企业，10年行业经验。",
      verifiedStatus: "VERIFIED", memberLevel: "SILVER",
      responseRate: 88.0, viewCount: 860, inquiryCount: 23,
    },
    {
      name: "江苏液压科技有限公司", shortName: "江苏液压", slug: "js-yy",
      province: "江苏", city: "无锡", address: "无锡新吴区",
      contactName: "张工", position: "技术总监", mobile: "+86-137-0000-0003",
      mainBusiness: "液压系统元件制造",
      mainBrands: "Sandvik · 小松 · 德纳",
      mainEquipment: "液压泵 · 液压马达 · 阀",
      description: "专业液压系统解决方案提供商，ISO9001认证。",
      verifiedStatus: "VERIFIED", memberLevel: "SILVER",
      responseRate: 92.0, viewCount: 640, inquiryCount: 18,
    },
    {
      name: "河南耐磨铸件有限公司", shortName: "河南铸业", slug: "hn-zy",
      province: "河南", city: "郑州", address: "郑州荥阳工业园",
      contactName: "刘厂长", position: "厂长", mobile: "+86-136-0000-0004",
      mainBusiness: "耐磨铸件与结构件生产",
      mainBrands: "Sandvik · 艾柯夫",
      mainEquipment: "截齿 · 衬板 · 结构件",
      description: "年产耐磨铸件5000吨，提供OEM替代件。",
      verifiedStatus: "VERIFIED", memberLevel: "BRONZE",
      responseRate: 85.0, viewCount: 420, inquiryCount: 12,
    },
    {
      name: "上海动力配件有限公司", shortName: "上海动力", slug: "sh-dl",
      province: "上海", city: "上海", address: "嘉定工业区",
      contactName: "陈经理", position: "销售经理", mobile: "+86-135-0000-0005",
      mainBusiness: "发动机配件分销",
      mainBrands: "康明斯 · 卡特",
      mainEquipment: "柴油发动机",
      description: "康明斯授权经销商，正品发动机配件。",
      verifiedStatus: "PENDING", memberLevel: "FREE",
      responseRate: 70.0, viewCount: 180, inquiryCount: 5,
    },
  ];
  const suppliers: Record<string, any> = {};
  for (const s of supplierData) {
    suppliers[s.shortName!] = await prisma.supplier.create({
      data: s,
    });
  }
  console.log(`✓ 供应商: ${supplierData.length}`);

  // ========== 配件分类 ==========
  const categoryData = [
    { name: "液压件", nameEn: "Hydraulic Parts", description: "液压泵、马达、阀、油缸、密封" },
    { name: "结构件", nameEn: "Structural Parts", description: "机架、压块、连接结构件" },
    { name: "耐磨件", nameEn: "Wear Parts", description: "截齿、衬板、铸锻耐磨件" },
    { name: "传动件", nameEn: "Transmission Parts", description: "齿轮箱、轴承、链条、差速器" },
    { name: "发动机件", nameEn: "Engine Parts", description: "发动机、滤芯、燃油系统" },
    { name: "电气件", nameEn: "Electrical Parts", description: "控制器、电机、传感器、电缆" },
    { name: "制动件", nameEn: "Brake Parts", description: "制动钳、刹车片、制动盘" },
  ];
  const categories: Record<string, any> = {};
  for (const c of categoryData) {
    categories[c.name] = await prisma.category.create({
      data: { ...c, slug: slug(c.nameEn!.replace(/ /g, "-")) },
    });
  }
  console.log(`✓ 分类: ${categoryData.length}`);

  // ========== 件号 + 产品 ==========
  const partData: Array<[string, string, string, string, string, string, string, number, string, boolean, string?]> = [
    ["山特维克", "山特维克 MB670-1", "XP210162", "锚杆机压块", "Retainer", "结构件", "宁东机电", 850, "现货/3天", false, "MB670-RET-001"],
    ["山特维克", "山特维克 MB670-1", "XP210162", "锚杆机压块", "Retainer", "结构件", "河南铸业", 820, "现货", false],
    ["山特维克", "山特维克 MB670-1", "XP123456", "截齿座", "Cutter Holder", "耐磨件", "河南铸业", 320, "现货", false],
    ["山特维克", "山特维克 MB670-1", "XP987654", "推进油缸密封包", "Feed Cylinder Seal Kit", "液压件", "江苏液压", 480, "7-15天", true, "XP987654-OEM"],
    ["山特维克", "山特维克 LS190", "A2U220-324006", "轴承座", "Bearing Housing", "传动件", "宁东机电", 2200, "7天", false],
    ["山特维克", "山特维克 LS190", "A2U220-324007", "主液压泵", "Hydraulic Pump", "液压件", "江苏液压", 18500, "15-30天", true],
    ["山特维克", "山特维克 LS190", "A2U220-324008", "制动钳", "Brake Caliper", "制动件", "江苏液压", 6800, "现货", false],
    ["卡特", "卡特 CL210", "100080382", "柴油滤清器", "Fuel Filter", "发动机件", "上海动力", 120, "现货", true],
    ["卡特", "卡特 CL210", "100080383", "机油泵", "Oil Pump", "发动机件", "上海动力", 2800, "7天", false],
    ["卡特", "卡特 CL210", "100080384", "变矩器", "Torque Converter", "传动件", "宁东机电", 35000, "30-45天", false],
    ["久益", "久益 10SC32", "137-97-01500-9-01", "诊断控制器", "Diagnostic Controller", "电气件", "宁东机电", 15000, "15天", false],
    ["久益", "久益 10SC32", "137-97-01500-9-02", "牵引电机", "Traction Motor", "电气件", "山东矿装", 22000, "20天", false],
    ["久益", "久益 10SC32", "137-97-01500-9-03", "刮板链条", "Scraper Chain", "传动件", "山东矿装", 850, "现货", false],
    ["小松", "小松 AD30", "HD30-110200", "转向油缸", "Steering Cylinder", "液压件", "江苏液压", 4500, "10天", false],
    ["小松", "小松 AD30", "HD30-110201", "差速器", "Differential", "传动件", "宁东机电", 28000, "30天", false],
    ["艾柯夫", "艾柯夫 SL300", "SL300-5501", "摇臂齿轮箱", "Shearer Gearbox", "传动件", "山东矿装", 120000, "60天/定制", false],
    ["艾柯夫", "艾柯夫 SL300", "SL300-5502", "滚筒截齿", "Cutting Picks", "耐磨件", "河南铸业", 85, "现货", false],
    ["康明斯", "", "FF-6001", "燃油精滤器", "Fuel Fine Filter", "发动机件", "上海动力", 95, "现货", true],
  ];

  const partCache: Record<string, any> = {};
  let productCount = 0;

  for (const [brand, equipKey, pn, name, nameEn, cat, supplier, price, leadTime, isOEM, oemNumber] of partData) {
    if (!partCache[pn]) {
      partCache[pn] = await prisma.partNumber.create({
        data: {
          number: pn,
          slug: slug(pn),
          name,
          nameEn,
          category: cat,
          categoryId: categories[cat]?.id || null,
          oemStatus: isOEM ? "OEM" : "AFTERMARKET",
          verified: true,
          description: `${name}（${nameEn}）`,
          specification: "详见图纸或询价",
          material: cat === "耐磨件" ? "合金钢/高锰钢" : cat === "液压件" ? "合金钢+密封件" : "按图纸",
          seoTitle: `${pn} ${name} - ${brand}配件 | 矿配云`,
          seoDescription: `${brand}设备件号${pn}（${name}/${nameEn}），适配${equipKey}，多家供应商报价。`,
          brandId: brands[brand]?.id || null,
          equipmentId: equipKey ? equipment[equipKey]?.id || null : null,
        },
      });
    }
    const stockQty = Math.floor(Math.random() * 50) + 5;
    await prisma.product.create({
      data: {
        partNumberId: partCache[pn].id,
        supplierId: suppliers[supplier].id,
        name: `${name} (${supplier})`,
        nameEn: `${nameEn} (${supplier})`,
        productType: isOEM ? "OEM" : "Aftermarket",
        oemNumber: oemNumber || null,
        specification: "详见图纸",
        material: cat === "耐磨件" ? "合金钢/高锰钢" : cat === "液压件" ? "合金钢+密封" : "按图纸",
        application: equipKey ? `${equipKey} 配套使用` : "通用配件",
        price,
        leadTime,
        stock: stockQty,
        stockStatus: stockQty > 10 ? "IN_STOCK" : stockQty > 0 ? "LOW_STOCK" : "MADE_TO_ORDER",
        moq: isOEM ? 1 : 10,
        warranty: isOEM ? "12个月" : "6个月",
      },
    });
    productCount++;
  }
  console.log(`✓ 件号: ${Object.keys(partCache).length}, 产品: ${productCount}`);

  // ========== 询价单 ==========
  const rfqs = await Promise.all([
    prisma.rFQ.create({
      data: {
        title: "山特维克 LS190 液压泵采购",
        partNumberId: partCache["A2U220-324007"].id,
        brandId: brands["山特维克"].id,
        equipmentId: equipment["山特维克 LS190"]?.id || null,
        productName: "主液压泵",
        brandName: "山特维克",
        equipmentModel: "LS190",
        quantity: 2,
        unit: "台",
        description: "需要 LS190 主液压泵，欢迎中国供应商报价。",
        purchaseType: "NORMAL",
        deliveryLocation: "山西朔州",
        incoterm: "EXW",
        contactName: "张经理",
        contactPhone: "+86-138-XXXX-XXXX",
        contactEmail: "zhang@mine.example",
        whatsapp: "+86-138-XXXX-XXXX",
        visibility: "PUBLIC",
        status: "COLLECTING",
        region: "山西",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.rFQ.create({
      data: {
        title: "卡特 CL210 机油泵长期采购",
        partNumberId: partCache["100080383"].id,
        brandId: brands["卡特"].id,
        equipmentId: equipment["卡特 CL210"]?.id || null,
        productName: "机油泵",
        brandName: "卡特",
        equipmentModel: "CL210",
        quantity: 4,
        unit: "台",
        description: "长期采购卡特 CL210 机油泵，要求 OEM 或同等品质。",
        purchaseType: "LONG_TERM",
        deliveryLocation: "陕西榆林",
        incoterm: "FOB",
        contactName: "李工",
        contactPhone: "+86-139-XXXX-XXXX",
        contactEmail: "li@mine.example",
        visibility: "MATCHED_SUPPLIERS",
        status: "QUOTED",
        region: "陕西",
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
  console.log(`✓ 询价单: ${rfqs.length}`);

  await prisma.quote.create({
    data: {
      rfqId: rfqs[0].id,
      supplierId: suppliers["江苏液压"].id,
      unitPrice: 17800,
      currency: "CNY",
      quantity: 2,
      moq: 1,
      stockStatus: "MADE_TO_ORDER",
      leadTime: "20天",
      warranty: "12个月",
      paymentTerms: "30%预付，70%见提单",
      incoterm: "EXW",
      remarks: "OEM 品质，质保一年",
      status: "PENDING",
    },
  });
  console.log(`✓ 报价: 1`);

  // ========== 用户 ==========
  const bcrypt = await import("bcryptjs");
  const adminHash = await bcrypt.hash("Ningdong@2026", 10);
  await prisma.user.createMany({
    data: [
      { email: "554324068@qq.com", name: "平台管理员", role: "ADMIN", passwordHash: adminHash, status: "ACTIVE" },
      { email: "buyer@mine.com", name: "张采购", role: "BUYER", company: "山西某矿业有限公司", status: "ACTIVE" },
      { email: "sales@ningdong.example", name: "宁东机电-李总", role: "SUPPLIER", supplierId: suppliers["宁东机电"].id, status: "ACTIVE" },
      { email: "sales@jsyy.example", name: "江苏液压-张工", role: "SUPPLIER", supplierId: suppliers["江苏液压"].id, status: "ACTIVE" },
    ],
  });
  console.log(`✓ 用户: 4 (1管理员 + 1采购 + 2供应商)`);
  console.log(`  管理员邮箱: 554324068@qq.com  密码: Ningdong@2026`);

  // ========== 批量扩展：更多设备和件号 ==========
  // 额外设备（重点品牌优先）
  const extraEquipment: Array<[string, string, string, string, string, string, string]> = [
    // [品牌, 型号, 名称, 英文名, 类型, 系列, 应用]
    ["山特维克", "DD421i", "地下凿岩台车", "DD421i Jumbo", "Drill Jumbo", "DD系列", "地下金属矿"],
    ["山特维克", "LH301", "地下铲运机", "LH301 LHD", "LHD", "LH系列", "地下金属矿"],
    ["山特维克", "LH621i", "地下铲运机", "LH621i LHD", "LHD", "LH系列", "地下金属矿"],
    ["山特维克", "DT820", "凿岩台车", "DT820 Drill Rig", "Drill Jumbo", "DT系列", "地下金属矿"],
    ["卡特", "CL215", "地下铲运机", "CL215 LHD", "LHD", "CL系列", "地下金属矿"],
    ["卡特", "R1300G", "地下铲运机", "R1300G LHD", "LHD", "R系列", "地下金属矿"],
    ["卡特", "AD22", "地下自卸车", "AD22 Truck", "Underground Truck", "AD系列", "地下金属矿"],
    ["久益", "12CM30", "连续采煤机", "12CM30 Continuous Miner", "Continuous Miner", "CM系列", "井工矿"],
    ["久益", "6LS5", "采煤机", "6LS5 Shearer", "Shearer", "6LS系列", "井工矿"],
    ["久益", "KM15", "破碎机", "KM15 Crusher", "Crusher", "KM系列", "井工矿"],
    ["小松", "AD45", "地下自卸车", "AD45 Truck", "Underground Truck", "AD系列", "地下金属矿"],
    ["小松", "WJ33", "地下铲运机", "WJ33 LHD", "LHD", "WJ系列", "地下金属矿"],
    ["艾柯夫", "SL500", "采煤机", "SL500 Shearer", "Shearer", "SL系列", "井工矿"],
    ["艾柯夫", "SL750", "采煤机", "SL750 Shearer", "Shearer", "SL系列", "井工矿"],
    ["康明斯", "QSK60", "柴油发动机", "QSK60 Engine", "Engine", "QSK系列", "矿山动力"],
    ["康明斯", "KTA19", "柴油发动机", "KTA19 Engine", "Engine", "KTA系列", "矿山动力"],
    ["芬瑞特", "MiningStar-1", "单轨吊", "MiningStar-1 Monorail", "Monorail", "MS系列", "井工矿"],
    ["德纳", "TC-21", "变矩器", "TC-21 Torque Converter", "Transmission", "TC系列", "传动系统"],
    ["美卓", "MK-III", "圆锥破碎机", "MK-III Cone Crusher", "Crusher", "MK系列", "破碎筛分"],
    ["勒图尔勒", "L-2350", "轮式装载机", "L-2350 Wheel Loader", "Wheel Loader", "L系列", "露天矿"],
  ];

  let extraEqCount = 0;
  for (const [brand, model, name, nameEn, eqType, series, mineType] of extraEquipment) {
    const b = brands[brand];
    if (!b) continue;
    await prisma.equipment.create({
      data: {
        brandId: b.id,
        name, nameEn, model, series,
        slug: slug(model),
        equipmentType: eqType,
        mineType,
        application: mineType,
        manufacturer: brand,
        description: `${brand} ${model} ${name}`,
        status: "ACTIVE",
      },
    });
    extraEqCount++;
  }
  console.log(`✓ 新增设备: ${extraEqCount}`);

  // 批量生成件号（每个设备生成 5-10 个件号）
  const catNames = ["液压件", "结构件", "耐磨件", "传动件", "发动机件", "电气件", "制动件"];
  const partsPerEq = [
    ["液压泵", "Hydraulic Pump", "液压件"],
    ["油缸密封包", "Seal Kit", "液压件"],
    ["轴承座", "Bearing Housing", "传动件"],
    ["截齿", "Cutting Picks", "耐磨件"],
    ["控制模块", "Control Module", "电气件"],
    ["制动片", "Brake Pad", "制动件"],
    ["滤芯", "Filter Element", "发动机件"],
    ["连接轴", "Connecting Shaft", "结构件"],
  ];

  let extraPnCount = 0;
  const allEquipment = await prisma.equipment.findMany({ include: { brand: true } });
  const allSuppliers = await prisma.supplier.findMany();

  for (const eq of allEquipment) {
    // 每个设备生成 5 个件号
    for (let i = 0; i < 5; i++) {
      const [partName, partNameEn, cat] = partsPerEq[i % partsPerEq.length];
      const pnPrefix = eq.brand.nameEn?.substring(0, 2).toUpperCase() || "PN";
      const pnNumber = `${pnPrefix}${eq.model.replace(/[^0-9]/g, "")}-${100 + i}`;

      // 检查是否已存在
      const existing = await prisma.partNumber.findUnique({ where: { number: pnNumber } });
      if (existing) continue;

      await prisma.partNumber.create({
        data: {
          number: pnNumber,
          slug: slug(pnNumber),
          name: partName,
          nameEn: partNameEn,
          category: cat,
          categoryId: categories[cat]?.id || null,
          description: `${partName}（${partNameEn}），适配${eq.brand.name} ${eq.model}`,
          seoTitle: `${pnNumber} ${partName} for ${eq.brand.name} ${eq.model} | 矿配云`,
          seoDescription: `${pnNumber} ${partNameEn} replacement parts for ${eq.brand.name} ${eq.model} mining equipment from verified suppliers.`,
          brandId: eq.brandId,
          equipmentId: eq.id,
        },
      });

      // 为每个件号随机选 1-3 个供应商生成产品
      const numSuppliers = Math.min(3, allSuppliers.length);
      for (let s = 0; s < numSuppliers; s++) {
        const supplier = allSuppliers[Math.floor(Math.random() * allSuppliers.length)];
        const price = Math.floor(Math.random() * 5000) + 100;
        const stockQty = Math.floor(Math.random() * 50) + 5;
        await prisma.product.create({
          data: {
            partNumberId: (await prisma.partNumber.findUnique({ where: { number: pnNumber } }))!.id,
            supplierId: supplier.id,
            name: `${partName} (${supplier.shortName})`,
            productType: "Aftermarket",
            price,
            leadTime: ["现货", "7天", "15天", "30天"][Math.floor(Math.random() * 4)],
            stock: stockQty,
            stockStatus: stockQty > 10 ? "IN_STOCK" : "MADE_TO_ORDER",
            moq: 10,
            warranty: "6个月",
          },
        });
      }
      extraPnCount++;
    }
  }
  console.log(`✓ 新增件号: ${extraPnCount}`);

  const totalPn = await prisma.partNumber.count();
  const totalProducts = await prisma.product.count();
  const totalEq = await prisma.equipment.count();
  console.log(`📊 总计: 品牌 ${await prisma.brand.count()}, 设备 ${totalEq}, 件号 ${totalPn}, 产品 ${totalProducts}, 供应商 ${await prisma.supplier.count()}`);

  console.log("✅ 播种完成！");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
