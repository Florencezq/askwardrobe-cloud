const {url, publishableKey} = window.wardrobeConfig;
const client = window.supabase.createClient(url, publishableKey);
const bucket = client.storage.from('wardrobe-garments');
const el = id => document.getElementById(id);
const pageSize = 16;
let user = null, register = location.hash === '#register', page = 0, view = 'wardrobe';
let listRequest = 0, lastLoad = 0, uploading = false;
const setStatus = text => { el('status').textContent = text; };

function authMode() {
  el('auth-title').textContent = register ? '注册衣橱账号' : '登录我的衣橱';
  el('submit-auth').textContent = register ? '注册并登录' : '登录';
  el('switch-auth').textContent = register ? '已有账号，去登录' : '还没有账号？去注册';
  const password = el('account-form').elements.password;
  password.autocomplete = register ? 'new-password' : 'current-password';
  password.minLength = register ? 8 : 1;
  password.placeholder = register ? '至少 8 个字符' : '';
}

function showView(next) {
  view = next;
  el('auth').hidden = !!user;
  el('nav').hidden = !user;
  for (const name of ['wardrobe','profile']) {
    const active = !!user && view === name;
    el(name).hidden = !active;
    el('nav-'+name).classList.toggle('active',active);
    el('nav-'+name).setAttribute('aria-current',active ? 'page' : 'false');
  }
  el('retry').hidden = true;
  setStatus('');
  if (user && view === 'wardrobe') loadGarments();
}

function identity(current) {
  if (current?.id === user?.id && !el('auth').hidden) return;
  if (current && user?.id === current.id) return;
  listRequest++;
  user = current;
  page = 0;
  el('garments').replaceChildren();
  el('preview').close();
  el('preview').querySelector('img').removeAttribute('src');
  el('account-form').reset();
  el('email').textContent = user?.email || '';
  authMode();
  showView('wardrobe');
}

function garmentCard(file,signedUrl) {
  const tile = document.createElement('article');
  tile.className = 'tile';
  const open = document.createElement('button');
  open.className = 'pic';
  const image = new Image();
  image.className = 'cover'; image.alt = '衣物图'; image.loading = 'lazy'; image.src = signedUrl;
  open.append(image);
  open.onclick = () => {
    el('preview').querySelector('img').src = signedUrl;
    el('preview').showModal();
  };
  const date = document.createElement('footer');
  date.textContent = new Date(file.created_at).toLocaleDateString('zh-CN');
  tile.append(open,date);
  return tile;
}

async function loadGarments() {
  const owner = user?.id;
  if (!owner) return;
  const serial = ++listRequest;
  setStatus('正在读取衣物…');
  el('retry').hidden = true;
  try {
    const {data:files,error} = await bucket.list(owner,{
      limit:pageSize+1, offset:page*pageSize, sortBy:{column:'created_at',order:'desc'}
    });
    if (error) throw error;
    const visible = files.slice(0,pageSize);
    const paths = visible.map(file => owner+'/'+file.name);
    let urls = [];
    if (paths.length) {
      const response = await bucket.createSignedUrls(paths,3600);
      if (response.error || response.data.some(item => !item.signedUrl)) throw Error('图片读取失败');
      urls = response.data.map(item=>item.signedUrl);
    }
    if (serial !== listRequest || view !== 'wardrobe') return;
    el('garments').replaceChildren(...visible.map((file,i)=>garmentCard(file,urls[i])));
    el('empty').hidden = files.length !== 0 || page !== 0;
    el('previous').hidden = page === 0;
    el('next').hidden = files.length <= pageSize;
    lastLoad = Date.now();
    setStatus('');
  } catch {
    if (serial !== listRequest || view !== 'wardrobe') return;
    el('retry').hidden = false;
    setStatus('读取衣橱失败，请检查网络后重试。');
  }
}

function authError(error) {
  if (error.code === 'invalid_credentials') return '邮箱或密码不正确。';
  if (error.code === 'user_already_exists') return '此邮箱已注册，请登录。';
  if (error.code === 'email_not_confirmed') return '请先打开验证邮件确认邮箱。';
  if (error.status === 429) return '尝试过于频繁，请稍后再试。';
  if (error.code === 'weak_password') return '请设置更强的密码，至少 8 个字符。';
  return '暂时无法完成操作，请检查邮箱、密码和网络后重试。';
}

el('account-form').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const credentials = {email:form.elements.email.value.trim(),password:form.elements.password.value};
  el('submit-auth').disabled = el('switch-auth').disabled = true;
  setStatus(register ? '正在创建账号…' : '正在登录…');
  try {
    const result = register ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
    if (result.error) throw result.error;
    if (!result.data.session) setStatus('请到邮箱确认注册，再回到这里登录。');
  } catch (error) { setStatus(authError(error)); }
  finally { el('submit-auth').disabled = el('switch-auth').disabled = false; }
};
el('switch-auth').onclick = () => { register = !register; authMode(); setStatus(''); };
el('nav-wardrobe').onclick = () => showView('wardrobe');
el('nav-profile').onclick = () => showView('profile');
el('previous').onclick = () => { page = Math.max(0,page-1); loadGarments(); };
el('next').onclick = () => { page++; loadGarments(); };
el('retry').onclick = () => loadGarments();
el('preview').querySelector('button').onclick = () => el('preview').close();
el('logout').onclick = async () => {
  const {error} = await client.auth.signOut({scope:'local'});
  if (error) setStatus('退出失败，请检查网络后重试。');
};

async function preparePhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15*1024*1024)
    throw Error('请选择 15 MB 以内的 JPG、PNG 或 WebP 衣物图。');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const scale = Math.min(1,1440/Math.max(image.naturalWidth,image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(image.naturalWidth*scale));
    canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return await new Promise((resolve,reject) => canvas.toBlob(blob => {
      if (blob && blob.size <= 3145728) resolve(blob);
      else reject(Error('图片太大，请选择较小的图片。'));
    },'image/jpeg',0.85));
  } finally { URL.revokeObjectURL(objectUrl); }
}

el('upload').onclick = () => el('file').click();
el('file').onchange = async event => {
  const file = event.target.files[0], owner = user?.id;
  event.target.value = '';
  if (!file || !owner || uploading) return;
  uploading = el('upload').disabled = true;
  const path = owner+'/'+crypto.randomUUID()+'.jpg';
  try {
    setStatus('正在上传衣物图…');
    const photo = await preparePhoto(file);
    if (user?.id !== owner) return;
    const {error} = await bucket.upload(path,photo,{contentType:'image/jpeg',upsert:false});
    if (error) {
      // A dropped response can arrive after Storage has already saved the file.
      const saved = await bucket.exists(path);
      if (!saved.data) throw Error('未能确认上传结果，请刷新衣橱后重试。');
    }
    if (user?.id !== owner) return;
    page = 0;
    await loadGarments();
    if (user?.id === owner && el('retry').hidden) setStatus('已保存到衣橱。');
  } catch (error) {
    if (user?.id === owner) setStatus(error.message || '上传失败，请重试。');
  } finally { uploading = el('upload').disabled = false; }
};
document.addEventListener('visibilitychange',() => {
  if (!document.hidden && user && view === 'wardrobe' && !uploading) loadGarments();
});
setInterval(() => {
  if (!document.hidden && user && view === 'wardrobe' && !uploading && Date.now()-lastLoad > 1800000) loadGarments();
},60000);
authMode();
client.auth.onAuthStateChange((_event,session) => {
  // Run Storage reads after the auth callback releases its session lock.
  setTimeout(()=>identity(session?.user || null),0);
});
