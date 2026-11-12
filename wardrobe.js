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
  async function garments(owner) {
    const items=[];
    for (let offset=0;;offset+=100) {
      const {data:files,error}=await bucket.list(owner,{limit:100,offset,sortBy:{column:'created_at',order:'desc'}});
      if (error) throw error;
      if (files.length) {
        const {data:links,error:linkError}=await bucket.createSignedUrls(files.map(file=>owner+'/'+file.name),3600);
        if (linkError) throw linkError;
        files.forEach((file,index)=>{
          if (!/^[0-9a-f-]{36}\.jpg$/.test(file.name)) return;
          const id=file.name.slice(0,-4),src='wardrobe:'+id;
          if (!links[index]?.signedUrl) throw Error('图片读取失败。');
          signed.set(src,links[index].signedUrl);
          items.push({id,src,type:'Uploads',slot:'garment',title:'衣物图',date:file.created_at.slice(0,10)});
        });
      }
      if (files.length<100) break;
    }
    return items;
  }
  async function upload(owner,blob) {
    const path=owner+'/'+crypto.randomUUID()+'.jpg';
    const {error}=await bucket.upload(path,blob,{contentType:'image/jpeg',upsert:false});
    if (error && !(await bucket.exists(path)).data) throw Error('上传失败，请检查网络后重试。');
  }
  async function remove(owner,id) {
    const {error}=await bucket.remove([owner+'/'+id+'.jpg']);
    if (error) throw Error('删除失败，请重试。');
  }
  async function profile(owner) {
    const {data,error}=await client.from('wardrobe_profiles').select('name,avatar,revision').eq('owner',owner).maybeSingle();
    if (error) throw error;
    return data;
  }
  async function saveProfile(owner,next,revision) {
    const fields={name:next.name,avatar:next.avatar,revision:revision+1};
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
  return {session,authenticate,garments,upload,remove,profile,saveProfile,signOut,imageUrl:src=>signed.get(src) || src};
})();
