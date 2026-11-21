export interface DeskOSSDK {
  app: {
    getInfo: () => Promise<{
      id: string;
      name: string;
      version: string;
      sdk: 1;
    }>;
  };
  theme: { getCurrent: () => Promise<{ theme: string; accent: string }> };
  window: { setTitle: (title: string) => Promise<void> };
  notifications: {
    show: (options: { title: string; message: string }) => Promise<void>;
  };
  storage: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  files: {
    pick: () => Promise<{ id: string; name: string; mime: string }>;
    read: (
      id: string,
    ) => Promise<{ text: string; revision: number; name: string }>;
    write: (
      id: string,
      text: string,
      revision: number,
    ) => Promise<{ revision: number }>;
  };
}
export const sdkRuntime = (token: string) => `
(()=>{const token=${JSON.stringify(token)},pending=new Map();let n=0;
addEventListener("message",e=>{const m=e.data;if(e.source!==parent||!m||m.protocol!==1||m.token!==token||!pending.has(m.id))return;const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.ok?p.resolve(m.result):p.reject(Error(m.error||"Host request failed"));});
function call(method,params={}){if(pending.size>=8)return Promise.reject(Error("Too many pending requests"));const id=String(++n);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error("DeskOS request timed out"));},90000);pending.set(id,{resolve,reject,timer});parent.postMessage({protocol:1,token,id,method,params},"*");});}
addEventListener("error",e=>parent.postMessage({protocol:1,token,id:String(++n),method:"runtime.error",params:{message:String(e.message).slice(0,500)}},"*"));
window.deskos=Object.freeze({app:{getInfo:()=>call("app.info")},theme:{getCurrent:()=>call("theme.current")},window:{setTitle:title=>call("window.title",{title})},notifications:{show:options=>call("notifications.show",options)},storage:{get:key=>call("storage.get",{key}),set:(key,value)=>call("storage.set",{key,value})},files:{pick:()=>call("files.pick"),read:id=>call("files.read",{id}),write:(id,text,revision)=>call("files.write",{id,text,revision})}});
})();`;
