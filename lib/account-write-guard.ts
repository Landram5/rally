// Every mutation checks the deletion lock inside the same D1 transaction.
// This also protects requests that authenticated just before deletion started.
export function guardAccountWrites(db:D1Database,authId:string):D1Database {
 const originals=new WeakMap<D1PreparedStatement,D1PreparedStatement>();
 const guard=()=>db.prepare('INSERT INTO account_write_guards (auth_id) VALUES (?)').bind(authId);
 const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>{
  const proxy=new Proxy(statement,{get(target,property){
   if(property==='bind')return (...values:unknown[])=>wrap(target.bind(...values));
   if(property==='run')return async()=>{const results=await db.batch([guard(),target]);return results[1]};
   const value=Reflect.get(target,property);
   return typeof value==='function'?value.bind(target):value;
  }});
  originals.set(proxy,statement);return proxy;
 };
 return new Proxy(db,{get(target,property){
  if(property==='prepare')return (sql:string)=>wrap(target.prepare(sql));
  if(property==='batch')return async(statements:D1PreparedStatement[])=>{
   const results=await target.batch([guard(),...statements.map(s=>originals.get(s)??s)]);return results.slice(1);
  };
  const value=Reflect.get(target,property);
  return typeof value==='function'?value.bind(target):value;
 }});
}
