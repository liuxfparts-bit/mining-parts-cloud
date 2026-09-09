// ============================================================
// 图片/文件存储抽象层
// 第一阶段：本地存储（public/uploads）
// 生产切换：腾讯云 COS（兼容 S3 接口）
// 使用：STORAGE_DRIVER 环境变量切换
// ============================================================

const driver = process.env.STORAGE_DRIVER || "local";

export interface StorageAdapter {
  saveFile(buffer: Buffer, filename: string): Promise<{ url: string; path: string }>;
  getPublicUrl(path: string): string;
}

// 本地存储
class LocalStorage implements StorageAdapter {
  async saveFile(buffer: Buffer, filename: string) {
    const path = `uploads/${filename}`;
    const fs = await import("fs/promises");
    const pathModule = await import("path");
    const fullPath = pathModule.join(process.cwd(), "public", path);
    await fs.mkdir(pathModule.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return { url: `/${path}`, path };
  }
  getPublicUrl(path: string) {
    return path.startsWith("http") ? path : `/${path}`;
  }
}

// 腾讯云 COS（预留，生产启用）
class TencentCosStorage implements StorageAdapter {
  async saveFile(_buffer: Buffer, filename: string) {
    // TODO: 接入 cos-nodejs-sdk-v5
    // const COS = require('cos-nodejs-sdk-v5');
    // const cos = new COS({ SecretId, SecretKey });
    // await cos.putObject({ Bucket, Region, Key: `uploads/${filename}`, Body: buffer });
    const cdn = process.env.COS_CDN_DOMAIN || "";
    return { url: `${cdn}/uploads/${filename}`, path: `uploads/${filename}` };
  }
  getPublicUrl(path: string) {
    if (path.startsWith("http")) return path;
    const cdn = process.env.COS_CDN_DOMAIN || "";
    return `${cdn}/${path}`;
  }
}

let storage: StorageAdapter;
if (driver === "cos") {
  storage = new TencentCosStorage();
} else {
  storage = new LocalStorage();
}

export { storage };
