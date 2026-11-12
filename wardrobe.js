window.cloudWardrobe = (() => {
  const {url,publishableKey} = window.wardrobeConfig;
  const client = window.supabase.createClient(url,publishableKey);
  const bucket = client.storage.from('wardrobe-garments');
  const signed = new Map();
  async function session() {
    const {data,error} = await client.auth.getSession();
    if (error) throw error;
    const u = data.session?.user;
    return u ? {id:u.id,email:u.email} : null;
  }
  async function authenticate(register,credentials) {
    const result = register ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
    if (result.error) {
      const errors={invalid_credentials:'邮箱或密码不正确。',user_already_exists:'此邮箱已注册，请登录。',weak_password:'请设置至少 8 个字符的密码。'};
      throw Error(errors[result.error.code] || (result.error.status===429 ? '尝试过于频繁，请稍后再试。' : '操作失败，请检查邮箱和网络后重试。'));
    }
    if (!result.data.session) throw Error('请到邮箱确认注册，再回来登录。');
  }
  const looks=client.storage.from('wardrobe-looks');
  async function listPhotos(owner,storage,isLook) {
    const items=[];
    for (let offset=0;;offset+=100) {
      const {data:files,error}=await storage.list(owner,{limit:100,offset,sortBy:{column:'created_at',order:'desc'}});
      if (error) throw error;
      if (files.length) {
        const {data:links,error:linkError}=await storage.createSignedUrls(files.map(file=>owner+'/'+file.name),3600);
        if (linkError) throw linkError;
        files.forEach((file,index)=>{
          if (!/^[0-9a-f-]{36}\.jpg$/.test(file.name)) return;
          const id=file.name.slice(0,-4),src='wardrobe:'+id;
          if (!links[index]?.signedUrl) throw Error('图片读取失败。');
          signed.set(src,links[index].signedUrl);
          const detail=isLook ? {type:'Try On',engine:'openai',title:'虚拟试穿',parts:[]} : {type:'Uploads',slot:'garment',title:'衣物图'};
          items.push({id,src,...detail,date:file.created_at.slice(0,10),created:file.created_at});
        });
      }
      if (files.length<100) break;
    }
    return items;
  }
  async function garments(owner) {
    const groups=await Promise.all([listPhotos(owner,bucket,false),listPhotos(owner,looks,true)]);
    return groups.flat().sort((a,b)=>b.created.localeCompare(a.created));
  }
  async function tryOnState() {
    const {data,error}=await client.rpc("wardrobe_tryon_state");
    if (error) throw Error("试穿状态暂时无法读取。");
    return data;
  }
  async function recoverTryOn(id) {
    const {error}=await client.functions.invoke("wardrobe-tryon",{body:{action:"recover",id}});
    if (error) throw Error("成片正在同步到衣橱。");
  }
  async function submitTryOn(job) {
    async function photo(src) {
      if (!src.startsWith("data:image/jpeg;base64,") && !["assets/person.webp","assets/jacket.webp"].includes(src)) throw Error("请重新选择照片。");
      const response=await fetch(src);
      if (!response.ok) throw Error("无法读取照片。");
      return response.blob();
    }
    const form=new FormData();
    form.set("id",job.id);
    form.set("person",await photo(job.person),"person");
    if (job.garment.startsWith("wardrobe:")) form.set("garmentId",job.garment.slice(9));
    else form.set("garment",await photo(job.garment),"garment");
    const {error}=await client.functions.invoke("wardrobe-tryon",{body:form});
    if (error) {
      const response=error.context;
      const message=await response?.json?.().catch(()=>({}));
      throw Object.assign(Error(message?.error || "暂时无法确认提交结果，请检查连接。"),{status:response?.status});
    }
  }
  async function upload(owner,blob) {
    const path=owner+'/'+crypto.randomUUID()+'.jpg';
    const {error}=await bucket.upload(path,blob,{contentType:'image/jpeg',upsert:false});
    if (error && !(await bucket.exists(path)).data) throw Error('上传失败，请检查网络后重试。');
  }
  async function remove(owner,id,isLook) {
    const {error}=await (isLook ? looks : bucket).remove([owner+'/'+id+'.jpg']);
    if (error) throw Error('删除失败，请重试。');
  }
  async function profile(owner) {
    const {data,error}=await client.from('wardrobe_profiles').select('name,avatar,plans,revision').eq('owner',owner).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function saveProfile(owner,next,revision) {
    const fields={name:next.name,avatar:next.avatar,plans:next.plans,revision:revision+1};
    const table=client.from('wardrobe_profiles');
    const query=revision ? table.update(fields).eq('owner',owner).eq('revision',revision) : table.insert({...fields,owner});
    const {data,error}=await query.select('revision').maybeSingle();
    if (error?.code==='23505' || (!error && !data)) throw Object.assign(Error('资料已在另一设备更新，请重新保存。'),{status:409});
    if (error) throw Error('资料保存失败，请稍后重试。');
    return data;
  }
  async function signOut() {
    const {error}=await client.auth.signOut({scope:'local'});
    if (error) throw Error('退出失败，请检查网络后重试。');
  }
  return {tryOnState,recoverTryOn,submitTryOn,session,authenticate,garments,upload,remove,profile,saveProfile,signOut,imageUrl:src=>signed.get(src) || src};
})();
