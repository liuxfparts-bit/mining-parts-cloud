import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import esbuild from "esbuild";

const originalCwd = process.cwd();
const root = await mkdtemp(path.join(tmpdir(), "quote-http-"));
const legacy = "/uploads/quote/legacy-quote.pdf";
const scoped = "/uploads/quote-attachment/supplier-7/1700000000000-abcdef123456.pdf";
const users = {
  admin: { id: 1, role: "ADMIN", status: "ACTIVE" },
  owner: { id: 11, role: "BUYER", buyerCompanyId: 4, status: "ACTIVE" },
  coworker: { id: 12, role: "BUYER", buyerCompanyId: 4, status: "ACTIVE" },
  outsider: { id: 13, role: "BUYER", buyerCompanyId: 5, status: "ACTIVE" },
  supplier: { id: 17, role: "SUPPLIER", supplierId: 7, status: "ACTIVE" },
  otherSupplier: { id: 18, role: "SUPPLIER", supplierId: 8, status: "ACTIVE" },
};
const fixture = { who: "anonymous", collision: false };
globalThis.__quoteFixture = { fixture, users };
const mocks = {
  "@/lib/auth": 'export async function auth() { const f=globalThis.__quoteFixture; const u=f.users[f.fixture.who]; return u ? {user:{id:String(u.id)}} : null; }',
  "@/lib/prisma": `const f=globalThis.__quoteFixture;
  const none={findFirst:async()=>null};
  export const prisma={
    user:{findUnique:async()=>Object.values(f.users).find(x=>x.id===f.users[f.fixture.who]?.id)||null},
    quote:{findFirst:async({where})=>where?.attachments?.contains?.includes("quote") ? {id:100,supplierId:7,rfq:{userID:11,companyID:4,visibility:"PUBLIC",businessAuthenticity:"REAL",matchedSuppliers:"[]"}}:null},
    banner:{findFirst:async()=>f.fixture.collision?{id:99}:null},
    brand:none,equipment:none,product:none,partNumber:none,supplier:none,
    partNumberRequest:none,equipmentRequest:none,rFQ:none,rFQItem:none,buyerCompany:none
  };`,
  "@/lib/public-product": 'export const PUBLIC_PRODUCT_WHERE={};export const PUBLIC_SUPPLIER_IDENTITY_WHERE={};',
  "@/lib/part-number": 'export const PUBLIC_PN_WHERE={};',
  "next/server": 'export class NextResponse extends Response { constructor(body, init){super(body,init)} }',
};
const build = await esbuild.build({
  entryPoints:["src/app/uploads/[...path]/route.ts"],bundle:true,platform:"node",format:"cjs",
  write:false,plugins:[{name:"http-fixtures",setup(b){
    b.onResolve({filter:/^(next\/server|@\/lib\/(auth|prisma|public-product|part-number))$/},a=>({path:a.path,namespace:"mock"}));
    b.onLoad({filter:/.*/,namespace:"mock"},a=>({contents:mocks[a.path],loader:"js"}));
  }}],
});
const mod = {exports:{}};
new Function("require","module","exports",build.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
const {GET} = mod.exports;
let server;
try {
  for(const url of [legacy,scoped]){
    const file=path.join(root,"public",url.slice(1));
    await mkdir(path.dirname(file),{recursive:true});
    await writeFile(file,"PRIVATE-QUOTE-FIXTURE");
  }
  process.chdir(root);
  server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,"http://127.0.0.1");
      const response=await GET(new Request(url),{params:{path:url.pathname.replace(/^\/uploads\//,"").split("/") }});
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch(e){res.writeHead(500);res.end(String(e));}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  const cases=[["anonymous",404],["owner",200],["coworker",200],["outsider",404],["supplier",200],["otherSupplier",404],["admin",200]];
  let count=0;
  for(const url of [legacy,scoped]){
    for(const [who,expected] of cases){
      fixture.who=who;fixture.collision=false;
      const response=await fetch(`http://127.0.0.1:${port}${url}`);
      assert.equal(response.status,expected,`${url} ${who}`);
      if(expected===200){assert.equal(await response.text(),"PRIVATE-QUOTE-FIXTURE");assert.equal(response.headers.get("cache-control"),"private, no-store");}
      count++;
    }
  }
  fixture.who="outsider";fixture.collision=true;
  const collision=await fetch(`http://127.0.0.1:${port}${legacy}`);
  assert.equal(collision.status,404,"public banner collision must not expose private legacy quote");
  count++;
  console.log(`Isolated HTTP quote attachment authorization: PASS (${count} requests, legacy/scoped, public collision)`);
} finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  process.chdir(originalCwd);
  await rm(root,{recursive:true,force:true});
}
