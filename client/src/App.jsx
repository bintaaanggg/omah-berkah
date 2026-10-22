import React, {useEffect, useState, useContext, createContext, useRef, useLayoutEffect} from 'react';
import {BrowserRouter, Routes, Route, Link, Outlet, useNavigate, useLocation} from 'react-router-dom';
import {api, getUser, saveSession, clearSession, uploadImage, API_URL} from './api';
import './style.css';
import './responsive.css';
import './app.css';
import './admin.css';
import './theme.css';

const asset = (p) => `/asset/${p}`;
const resolveImage = (p) => {
 if(!p) return '';
 if(p.startsWith('http')) return p;
 if(p.startsWith('/uploads/')) return `${API_URL}${p}`;
 return asset(p.replace(/^asset\//,''));
};

function AnimatedNumber({value, format}){
 const ref = useRef(null);
 const [display, setDisplay] = useState(0);
 const target = Number(String(value).replace(/[^\d.-]/g,'')) || 0;
 useEffect(()=>{
  const el = ref.current;
  if(!el) return;
  let started = false;
  const io = new IntersectionObserver((entries)=>{
   entries.forEach(e=>{
    if(e.isIntersecting && !started){
     started = true;
     const duration = 1400;
     const start = performance.now();
     const from = 0;
     const tick = (now)=>{
      const p = Math.min(1,(now-start)/duration);
      const eased = 1-Math.pow(1-p,3);
      setDisplay(Math.round(from+(target-from)*eased));
      if(p<1) requestAnimationFrame(tick);
     };
     requestAnimationFrame(tick);
     io.unobserve(el);
    }
   });
  },{threshold:.3});
  io.observe(el);
  return ()=>io.disconnect();
 },[target]);
 return <span ref={ref}>{format ? format(display) : display.toLocaleString('id-ID')}</span>;
}

function Lightbox({items, index, onClose, onNav}){
 useEffect(()=>{
  const onKey=(e)=>{
   if(e.key==='Escape') onClose();
   if(e.key==='ArrowRight') onNav(1);
   if(e.key==='ArrowLeft') onNav(-1);
  };
  window.addEventListener('keydown',onKey);
  document.body.style.overflow='hidden';
  return ()=>{ window.removeEventListener('keydown',onKey); document.body.style.overflow=''; };
 },[onClose,onNav]);
 const item = items[index];
 if(!item) return null;
 return <div className="lightbox-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
  <button className="lightbox-close" onClick={onClose}><i className="fa-solid fa-xmark"/></button>
  {items.length>1 && <button className="lightbox-nav lightbox-prev" onClick={()=>onNav(-1)}><i className="fa-solid fa-chevron-left"/></button>}
  <figure className="lightbox-figure">
   <img src={resolveImage(item.image)} alt={item.caption||'Galeri'}/>
   {item.caption && <figcaption>{item.caption}</figcaption>}
  </figure>
  {items.length>1 && <button className="lightbox-nav lightbox-next" onClick={()=>onNav(1)}><i className="fa-solid fa-chevron-right"/></button>}
  {items.length>1 && <div className="lightbox-counter">{index+1} / {items.length}</div>}
 </div>;
}
const rupiah = (n) => 'Rp' + Number(n||0).toLocaleString('id-ID');

const NAV_ITEMS = [
  {to:'/', label:'Beranda'},
  {to:'/tentang', label:'Tentang'},
  {to:'/visi-misi', label:'Visi & Misi'},
  {to:'/program', label:'Program'},
  {to:'/perjalanan', label:'Perjalanan'},
  {to:'/galeri', label:'Galeri'},
  {to:'/kontak', label:'Kontak'},
];

/* ================= Site data (fetched once, shared by every page) ================= */
const SiteDataContext = createContext(null);
function SiteDataProvider({children}){
  const [data,setData] = useState({programs:[],gallery:[],testimonials:[],timeline:[],stats:[]});
  const [donations,setDonations] = useState({total:0});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const load = async () => {
    setLoading(true);
    try{
      const [programs,gallery,testimonials,timeline,stats,summary] = await Promise.all([
        api('/programs'),api('/gallery'),api('/testimonials'),api('/timeline'),api('/stats'),api('/donations/summary')
      ]);
      setData({programs:programs.items,gallery:gallery.items,testimonials:testimonials.items,timeline:timeline.items,stats:stats.items});
      setDonations(summary);
      setError('');
    }catch(e){ setError(e.message); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);
  return <SiteDataContext.Provider value={{data,donations,loading,error,reload:load}}>{children}</SiteDataContext.Provider>;
}
function useSiteData(){ return useContext(SiteDataContext); }

/* ================= Donate modal (needs to open from any page) ================= */
const DonateContext = createContext(null);
const emptyDonate = {name:'',email:'',program_id:'',amount:'',message:'',paymentMethod:'qris'};
function DonateProvider({children}){
  const [open,setOpen] = useState(false);
  const [step,setStep] = useState(1);
  const [busy,setBusy] = useState(false);
  const [donate,setDonate] = useState(emptyDonate);
  const openModal = (programId) => {
    const user = getUser();
    const loggedInDonor = user && user.role!=='admin' ? {name:user.fullname, email:user.email} : {name:'',email:''};
    setDonate(d=>({...emptyDonate, ...loggedInDonor, program_id: programId||''}));
    setStep(1); setOpen(true);
  };
  const close = () => { setOpen(false); setTimeout(()=>{setStep(1); setDonate(emptyDonate);},250); };
  const confirm = async () => {
    setBusy(true);
    try{
      const user = getUser();
      const asMember = !!(user && user.role!=='admin');
      await api('/donations',{method:'POST',auth:asMember,body:{name:donate.name,email:donate.email,message:donate.message,amount:Number(donate.amount),program_id:donate.program_id?Number(donate.program_id):null}});
      setStep(3);
    }catch(e){ alert(e.message); }
    finally{ setBusy(false); }
  };
  return <DonateContext.Provider value={{open,step,setStep,busy,donate,setDonate,openModal,close,confirm}}>
    {children}
    {open && <DonateModal/>}
  </DonateContext.Provider>;
}
function useDonate(){ return useContext(DonateContext); }

const AMOUNT_PRESETS=[25000,50000,100000,250000];
const PAYMENT_METHODS=[
 {id:'bank',icon:'fa-building-columns',title:'Transfer Bank',sub:'Transfer ke rekening bank'},
 {id:'qris',icon:'fa-qrcode',title:'QRIS',sub:'Bayar dengan QRIS'},
 {id:'ewallet',icon:'fa-wallet',title:'E-Wallet',sub:'OVO, GoPay, DANA, dll'},
];

function Confetti(){
  const pieces = useRef(Array.from({length:60},(_,i)=>({
    id:i,
    left:Math.random()*100,
    delay:Math.random()*0.6,
    duration:2.2+Math.random()*1.6,
    size:6+Math.random()*7,
    color:['#16A34A','#E4A63A','#2FA866','#0B3D26','#fff'][i%5],
    rotate:Math.random()*360,
    drift:(Math.random()-0.5)*160,
  }))).current;
  return <div className="confetti-layer">
    {pieces.map(p=><span key={p.id} className="confetti-piece" style={{
      left:`${p.left}%`,
      animationDelay:`${p.delay}s`,
      animationDuration:`${p.duration}s`,
      width:p.size, height:p.size*0.4,
      background:p.color,
      '--drift':`${p.drift}px`,
      '--rotate':`${p.rotate}deg`,
    }}/>)}
  </div>;
}

function DonateModal(){
 const {step,setStep,busy,donate,setDonate,close,confirm} = useDonate();
 const {data} = useSiteData();
 const user = getUser();
 const asMember = !!(user && user.role!=='admin');
 const set=(k,v)=>setDonate(d=>({...d,[k]:v}));
 const paymentTitle=(PAYMENT_METHODS.find(m=>m.id===donate.paymentMethod)||{}).title||'-';
 const canContinue=donate.name.trim() && donate.email.trim() && Number(donate.amount)>0;

 return <div className="modal-overlay donate-flow" style={{display:'flex'}} onClick={e=>e.target===e.currentTarget&&step!==3&&close()}>
  <div className="modal-box">
   {step!==3 && <button className="modal-close" onClick={close}><i className="fa-solid fa-xmark"/></button>}

   {step===1 && <>
    <h3>Mari Berbagi Kebaikan</h3>
    <p className="modal-sub">Setiap donasi yang diberikan dapat membantu mendukung program kesehatan, pendidikan, sosial, dan pemberdayaan masyarakat.</p>

    {asMember && <div className="donor-badge"><i className="fa-solid fa-circle-check"/> Donasi sebagai <strong>{user.fullname}</strong> &mdash; tersimpan di riwayat akunmu.</div>}

    <div className="form-group"><label>Nama Lengkap</label><input value={donate.name} onChange={e=>set('name',e.target.value)} placeholder="Nama kamu" readOnly={asMember} disabled={asMember}/></div>
    <div className="form-group"><label>Email</label><input type="email" value={donate.email} onChange={e=>set('email',e.target.value)} placeholder="nama@contoh.com" readOnly={asMember} disabled={asMember}/></div>

    {data.programs?.length>0 && <div className="form-group"><label>Program (opsional)</label>
     <select value={donate.program_id} onChange={e=>set('program_id',e.target.value)}>
      <option value="">Umum / tidak spesifik</option>
      {data.programs.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
     </select>
    </div>}

    <div className="form-group">
     <label>Pilih Nominal Donasi</label>
     <div className="amount-presets">
      {AMOUNT_PRESETS.map(v=><button type="button" key={v} className={Number(donate.amount)===v?'active':''} onClick={()=>set('amount',String(v))}>Rp{(v/1000)}.000</button>)}
     </div>
     <label>Nominal lainnya</label>
     <input type="number" min="1000" step="1000" value={donate.amount} onChange={e=>set('amount',e.target.value)} placeholder="Masukkan nominal"/>
    </div>

    <div className="form-group">
     <label>Pilih Metode Pembayaran</label>
     <div className="payment-methods">
      {PAYMENT_METHODS.map(m=>
       <div key={m.id} className={`payment-card ${donate.paymentMethod===m.id?'active':''}`} onClick={()=>set('paymentMethod',m.id)}>
        <i className={`fa-solid ${m.icon} pm-icon`}/>
        <div className="pm-text"><span className="pm-title">{m.title}</span><span className="pm-sub">{m.sub}</span></div>
        <span className="pm-radio" style={{marginLeft:'auto'}}/>
       </div>
      )}
     </div>
    </div>

    <div className="form-group"><label>Pesan (opsional)</label><textarea value={donate.message} onChange={e=>set('message',e.target.value)} placeholder="Doa atau pesan untuk penerima manfaat..."/></div>

    <button className="btn-submit" disabled={!canContinue} onClick={()=>setStep(2)}>Donasi Sekarang</button>
   </>}

   {step===2 && <>
    <h3>Konfirmasi Donasi</h3>
    <p className="modal-sub">Pastikan detail donasi Anda sudah benar sebelum melanjutkan.</p>

    <div className="confirm-box">
     <div className="confirm-row">
      <div><div className="confirm-label">Nominal Donasi</div><div className="confirm-value big">{rupiah(donate.amount)}</div></div>
      <div><div className="confirm-label">Metode Pembayaran</div><div className="confirm-value">{paymentTitle}</div></div>
     </div>
     <div className="confirm-row">
      <div><div className="confirm-label">Atas Nama</div><div className="confirm-value">{donate.name}</div></div>
      <div><div className="confirm-label">Email</div><div className="confirm-value">{donate.email}</div></div>
     </div>
    </div>

    <div className="confirm-warning"><i className="fa-solid fa-circle-info"/><span>Ini pengajuan donasi, bukan pembayaran otomatis. Setelah menekan tombol Konfirmasi, tim Omah Berkah akan menghubungimu untuk proses pembayaran.</span></div>

    {donate.paymentMethod==='qris' && <div className="qris-box">
     <img src={asset('qris-omahberkah.jpg')} alt="QRIS Yi Shun Shin shop"/>
     <p><i className="fa-solid fa-circle-check"/> Scan QR di atas dengan aplikasi e-wallet/m-banking favoritmu, lalu masukkan nominal <strong>{rupiah(donate.amount)}</strong> dan selesaikan pembayaran.</p>
    </div>}

    <div className="confirm-actions">
     <button type="button" className="btn-outline-modal" onClick={()=>setStep(1)}>Kembali</button>
     <button type="button" className="btn-submit" disabled={busy} onClick={confirm}>{busy?'Memproses...':'Konfirmasi & Lanjutkan'}</button>
    </div>
   </>}

   {step===3 && <div className="donate-success">
    <Confetti/>
    <div className="success-icon"><i className="fa-solid fa-check"/></div>
    <h3>Terima Kasih!</h3>
    <p className="success-sub">Kebaikan Anda sangat berarti bagi masyarakat yang membutuhkan.</p>

    <div className="confirm-box">
     <div className="confirm-row">
      <div><div className="confirm-label">Nominal Donasi</div><div className="confirm-value">{rupiah(donate.amount)}</div></div>
      <div><div className="confirm-label">Metode Pembayaran</div><div className="confirm-value">{paymentTitle}</div></div>
     </div>
     <div><div className="confirm-label">Tanggal</div><div className="confirm-value">{new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} - {new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} WIB</div></div>
    </div>

    <button className="btn-primary" onClick={close}>Kembali ke Beranda</button>
   </div>}
  </div>
 </div>;
}

/* ================= Layout (header + footer, persists across page navigation) ================= */
function ScrollEffects(){
  const loc = useLocation();
  useEffect(()=>{
    const header=document.getElementById('header');
    const bar=document.getElementById('scroll-progress');
    const onScroll=()=>{
      header?.classList.toggle('active', window.scrollY>80);
      const max=document.documentElement.scrollHeight-window.innerHeight;
      if(bar) bar.style.width=(max>0?Math.min(100,(window.scrollY/max)*100):0)+'%';
    };
    window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
    return ()=>window.removeEventListener('scroll',onScroll);
  },[]);
  useEffect(()=>{
    const targets=document.querySelectorAll(
      '.section-title,.section-heading,.about-image,.about-content,.program-card,.visi-card,.misi-card,.timeline-item,.gallery-grid figure,.testimonial-card,.contact-info-card,.contact-form-card,.cta-inner,.hero-card,.quick-stat,.value-card,.faq-item,.impact-row,.member-welcome-inner'
    );
    if(!targets.length) return;
    targets.forEach(el=>el.classList.add('reveal'));
    const io=new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); } });
    },{threshold:.15, rootMargin:'0px 0px -8% 0px'});
    targets.forEach(el=>io.observe(el));
    return ()=>io.disconnect();
  },[loc.pathname]);
  return <div id="scroll-progress"/>;
}

function ScrollToTop(){
  const {pathname} = useLocation();
  useEffect(()=>{ window.scrollTo(0,0); },[pathname]);
  return null;
}

function Layout(){
  const nav=useNavigate(), loc=useLocation(), [user,setUser]=useState(getUser()), [open,setOpen]=useState(false);
  const {openModal} = useDonate();
  const navMenuRef=useRef(null), navLinkRefs=useRef({});
  const [userMenuOpen,setUserMenuOpen]=useState(false);
  const userMenuRef=useRef(null);
  useEffect(()=>{ setUser(getUser()); },[loc.pathname]);
  const logout=()=>{clearSession();setUser(null);setUserMenuOpen(false);nav('/');};
  useEffect(()=>{
    const onClickOutside=(e)=>{ if(userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown',onClickOutside);
    return ()=>document.removeEventListener('mousedown',onClickOutside);
  },[]);

  const movePill=()=>{
    const wrap=navMenuRef.current, el=navLinkRefs.current[loc.pathname];
    if(!wrap||!el) return;
    const wr=wrap.getBoundingClientRect(), r=el.getBoundingClientRect();
    wrap.style.setProperty('--pill-x',(r.left-wr.left)+'px');
    wrap.style.setProperty('--pill-w',r.width+'px');
    wrap.style.setProperty('--pill-on','1');
  };
  useLayoutEffect(()=>{ movePill(); },[loc.pathname]);
  useEffect(()=>{
    window.addEventListener('resize',movePill);
    return ()=>window.removeEventListener('resize',movePill);
  },[loc.pathname]);

  return <>
    <header className="header" id="header"><div className="container"><nav className="navbar">
      <Link to="/" className="logo" aria-label="Beranda" onClick={()=>setOpen(false)}>
        <img src={asset('logo-white-cropped.png')} className="logo-white" alt="Omah Berkah"/>
        <img src={asset('logo-green-cropped.png')} className="logo-green" alt="Omah Berkah"/>
      </Link>
      <ul className={`nav-menu ${open?'active':''}`} ref={navMenuRef}>
        {NAV_ITEMS.map(item=><li key={item.to}><Link to={item.to} ref={el=>{navLinkRefs.current[item.to]=el;}} className={loc.pathname===item.to?'active':''} onClick={()=>setOpen(false)}>{item.label}</Link></li>)}
        <li className="mobile-actions">
          <button className="mobile-donate" onClick={()=>{openModal();setOpen(false)}}>Donasi</button>
          {!user ? <Link to="/login" className="mobile-login" onClick={()=>setOpen(false)}>Login</Link> : <Link to={user.role==='admin'?'/admin':'/riwayat-donasi'} className="mobile-login" onClick={()=>setOpen(false)}>{user.role==='admin'?'Dashboard':'Riwayat Donasi'}</Link>}
        </li>
      </ul>
      <div className="nav-right">
        <button className="btn-donate" onClick={()=>openModal()}>Donasi</button>
        {!user ? <Link to="/login" className="btn-login">Login</Link> :
          <div className="nav-user show" ref={userMenuRef}>
            <button className="nav-user-trigger" onClick={()=>setUserMenuOpen(v=>!v)}>
              <span className="avatar">{(user.fullname||'?')[0].toUpperCase()}</span>
              <span className="fullname">{user.fullname}</span>
              <i className={`fa-solid fa-chevron-down nav-user-caret ${userMenuOpen?'open':''}`}/>
            </button>
            {userMenuOpen && <div className="nav-user-dropdown">
              <div className="nav-user-dropdown-head"><span className="avatar">{(user.fullname||'?')[0].toUpperCase()}</span><div><strong>{user.fullname}</strong>{user.member_no && <span>{user.member_no}</span>}</div></div>
              {user.role==='admin' ? <Link to="/admin" onClick={()=>setUserMenuOpen(false)}><i className="fa-solid fa-gauge-high"/> Dashboard Admin</Link> : <Link to="/riwayat-donasi" onClick={()=>setUserMenuOpen(false)}><i className="fa-solid fa-receipt"/> Riwayat Donasi</Link>}
              <button onClick={logout}><i className="fa-solid fa-right-from-bracket"/> Keluar</button>
            </div>}
          </div>}
        <button className="menu-toggle" onClick={()=>setOpen(v=>!v)}><i className="fa-solid fa-bars"/></button>
      </div>
    </nav></div></header>
    <ScrollEffects/><ScrollToTop/>
    <div key={loc.pathname} className="route-transition"><Outlet/></div>
    <Footer/>
    <WhatsAppFloatButton/>
  </>;
}

function WhatsAppFloatButton(){
  const [open,setOpen] = useState(false);
  return <div className="wa-float">
    {open && <div className="wa-float-card">
      <div className="wa-float-head"><i className="fa-brands fa-whatsapp"/><div><strong>Omah Berkah</strong><span>Biasanya membalas dalam beberapa menit</span></div><button onClick={()=>setOpen(false)}><i className="fa-solid fa-xmark"/></button></div>
      <p>Halo! Ada pertanyaan soal program, donasi, atau mau jadi relawan? Langsung chat kami aja.</p>
      <a href="https://wa.me/6282264183926?text=Halo%20Omah%20Berkah%2C%20saya%20ingin%20bertanya" target="_blank" rel="noreferrer" className="wa-float-cta"><i className="fa-brands fa-whatsapp"/> Mulai Chat</a>
    </div>}
    <button className="wa-float-trigger" onClick={()=>setOpen(v=>!v)} aria-label="Chat WhatsApp">{open?<i className="fa-solid fa-xmark"/>:<i className="fa-brands fa-whatsapp"/>}</button>
  </div>;
}

function Footer(){
  return <footer className="footer" id="kontak-footer"><div className="container footer-grid"><div className="footer-about"><h2><i className="fa-solid fa-leaf"/> LSM Omah Berkah</h2><p>Bergerak dalam bidang pendidikan, kesehatan, lingkungan, pemberdayaan masyarakat, dan Kawi Farm.</p></div><div className="footer-menu"><h3>Menu</h3><ul>{NAV_ITEMS.map(item=><li key={item.to}><Link to={item.to}>{item.label}</Link></li>)}</ul></div><div className="footer-contact"><h3>Kontak</h3><p><i className="fa-solid fa-location-dot"/> Malang, Jawa Timur</p><p><i className="fa-solid fa-phone"/> +62 822-6418-3926</p><p><i className="fa-solid fa-envelope"/> info@omahberkah.org</p></div><div className="footer-social"><h3>Ikuti Kami</h3><div className="social-icons"><a href="https://www.facebook.com/" aria-label="Facebook"><i className="fab fa-facebook-f"/></a><a href="https://www.instagram.com/bntgrmdhan._/" aria-label="Instagram"><i className="fab fa-instagram"/></a><a href="https://www.youtube.com/@Gustixa" aria-label="YouTube"><i className="fab fa-youtube"/></a><a href="https://wa.me/6282264183926" target="_blank" rel="noreferrer"><i className="fab fa-whatsapp"/></a></div></div></div><div className="copyright">© 2026 LSM Omah Berkah. All Rights Reserved.</div></footer>;
}

function PageBanner({eyebrow,title,subtitle,icon,variant='forest'}){
  return <section className="page-banner" data-variant={variant}>
    {icon && <i className={`fa-solid ${icon} page-banner-icon`} aria-hidden="true"/>}
    <div className="container">
      <span className="section-tag">{eyebrow}</span>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      <nav className="page-breadcrumb" aria-label="breadcrumb"><Link to="/">Beranda</Link><i className="fa-solid fa-chevron-right"/><span>{eyebrow}</span></nav>
    </div>
  </section>;
}

/* ================= Reusable content sections ================= */
function HeroSection(){
  const {data,donations} = useSiteData();
  return <section className="hero" id="home"><img src={asset('WhatsApp Image 2026-07-15 at 10.57.54 AM.jpeg')} className="hero-bg" alt="Hero"/><div className="hero-overlay"/><div className="container hero-content">
   <div className="hero-left"><span className="hero-tag">LSM OMAH BERKAH</span><h1>Bersama <span>Membangun</span> Masa Depan Indonesia</h1><p>Omah Berkah merupakan lembaga sosial yang bergerak di bidang pendidikan, kesehatan, pemberdayaan masyarakat, lingkungan hidup, dan Kawi Farm untuk menciptakan kehidupan yang lebih baik.</p><div className="hero-button"><Link to="/program" className="btn-primary">Lihat Program</Link><Link to="/tentang" className="btn-outline">Tentang Kami</Link></div></div>
   <div className="hero-right"><div className="hero-card"><h3>Impact Kami</h3><div className="hero-stat-grid">{data.stats.map(s=><div className="hero-stat" key={s.id}><h2><AnimatedNumber value={s.value}/>{s.suffix}</h2><span>{s.label}</span></div>)}</div>{donations.total>0&&<div className="donation-summary"><div className="label">Total donasi terkumpul</div><div className="amount"><AnimatedNumber value={donations.total} format={rupiah}/></div></div>}</div></div>
  </div></section>;
}

function AboutSection(){
  return <section className="about section" id="about"><div className="container about-wrapper"><div className="about-image"><img src={asset('ob.jpg')} alt="Tentang Omah Berkah"/><div className="experience-box"><h2><AnimatedNumber value={10}/>+</h2><p>Tahun Mengabdi</p></div></div><div className="about-content"><span className="section-tag">TENTANG KAMI</span><h2>Bersama Membangun Masyarakat yang Lebih Mandiri</h2><p>LSM Omah Berkah adalah lembaga sosial yang berkomitmen meningkatkan kesejahteraan masyarakat melalui pendidikan, kesehatan, pemberdayaan ekonomi, lingkungan hidup, dan program Kawi Farm.</p><div className="about-list">{[['fa-graduation-cap','Pendidikan','Beasiswa, pelatihan, dan pendampingan untuk meningkatkan kualitas pendidikan.'],['fa-heart-pulse','Kesehatan','Pemeriksaan kesehatan, bakti sosial, dan layanan kesehatan masyarakat.'],['fa-seedling','Kawi Farm','Program pertanian berkelanjutan untuk meningkatkan ekonomi warga.']].map(x=><div className="about-item" key={x[1]}><i className={`fa-solid ${x[0]}`}/><div><h4>{x[1]}</h4><p>{x[2]}</p></div></div>)}</div><Link to="/program" className="btn-primary">Selengkapnya</Link></div></div></section>;
}

function VisiMisiSection(){
  return <section className="visi-misi-section" id="visi-misi"><div className="visi-misi-decoration decoration-1"/><div className="visi-misi-decoration decoration-2"/><div className="container"><div className="section-heading"><span className="section-label">Tentang Kami</span><h2>Komitmen Kami untuk <span>Masyarakat</span></h2><p>Menjadi lembaga sosial yang memberikan manfaat nyata melalui pendidikan, kesehatan, pemberdayaan masyarakat, dan pelestarian lingkungan.</p></div><div className="visi-misi-wrapper"><div className="visi-card"><div className="card-top"><div className="visi-icon"><i className="fas fa-eye"/></div><span className="card-number">01</span></div><div className="card-content"><span className="small-title">VISI KAMI</span><h3>Visi</h3><div className="green-line"/><p>Terwujudnya Omah Berkah sebagai saluran berkat yang mengalirkan kebaikan dalam bentuk akses pendidikan, kesehatan, dan pemenuhan kebutuhan dasar bagi masyarakat di lingkungan sekitar.</p></div></div><div className="misi-card"><div className="card-top"><div className="misi-icon"><i className="fas fa-bullseye"/></div><span className="card-number">02</span></div><div className="card-content"><span className="small-title">MISI KAMI</span><h3>Misi</h3><div className="green-line"/><div className="misi-list">{['Menunjukkan kasih terhadap sesama melalui pelayanan kesehatan gratis, terutama bagi mereka yang membutuhkan.','Berbagi kebutuhan pokok secara cuma-cuma untuk meringankan beban masyarakat sekitar.','Mendukung hidup yang sehat dan layak dengan menyediakan layanan kebersihan lingkungan dan perlengkapan hidup dasar secara gratis.','Membuka pintu pendidikan yang lebih luas bagi anak-anak desa melalui bimbingan belajar gratis.'].map((m,i)=><div className="misi-item" key={i}><span className="misi-number">0{i+1}</span><p>{m}</p></div>)}</div></div></div></div></div></section>;
}

function LockedMore({count, gridClass, label, children}){
  if(count<=0) return null;
  return <div className="locked-section">
    <div className={`${gridClass} locked-blur`}>{children}</div>
    <div className="locked-overlay">
      <i className="fa-solid fa-lock"/>
      <h4>+{count} {label} Lainnya</h4>
      <p>Masuk ke akunmu untuk melihat semuanya.</p>
      <Link to="/login" className="btn-primary">Masuk Sekarang</Link>
    </div>
  </div>;
}

function ProgramProgress({raised,target}){
  const pct = Math.min(100, Math.round((raised/target)*100));
  return <div className="program-progress">
    <div className="program-progress-bar"><div className="program-progress-fill" style={{width:`${pct}%`}}/></div>
    <div className="program-progress-meta"><span><strong>{rupiah(raised)}</strong> terkumpul</span><span>{pct}%</span></div>
    <div className="program-progress-target">dari target {rupiah(target)}</div>
  </div>;
}

function ProgramSection({limit}){
  const {data} = useSiteData();
  const {openModal} = useDonate();
  const user = getUser();
  const items = limit ? data.programs.slice(0,limit) : data.programs;
  const guestGate = !limit && !user;
  const GUEST_VISIBLE = 2;
  const visible = guestGate ? items.slice(0,GUEST_VISIBLE) : items;
  const locked = guestGate ? items.slice(GUEST_VISIBLE) : [];
  const renderCard = p => <div className="program-card" key={p.id}><img src={resolveImage(p.image)} alt={p.title}/><div className="program-content"><i className={`fa-solid ${p.icon||'fa-heart'}`}/><h3>{p.title}</h3><p>{p.description}</p>{p.target_amount>0 && <ProgramProgress raised={Number(p.raised_amount||0)} target={Number(p.target_amount)}/>}<button className="btn-primary" onClick={()=>openModal(p.id)}>Dukung Program</button></div></div>;
  return <section className="program section" id="program"><div className="container"><div className="section-title"><span>PROGRAM KAMI</span><h2>{data.programs.length===3?'Tiga Pilar Kami':'Program Unggulan Kami'}</h2><p>Berbagai kegiatan sosial yang telah dijalankan oleh LSM Omah Berkah untuk membantu masyarakat.</p></div><div className="program-grid">{visible.map(renderCard)}</div>
  <LockedMore count={locked.length} gridClass="program-grid" label="Program">{locked.map(renderCard)}</LockedMore>
  {limit && data.programs.length>limit && <div className="section-cta"><Link to="/program" className="btn-outline">Lihat Semua Program</Link></div>}</div></section>;
}

function TimelineSection(){
  const {data} = useSiteData();
  return <section className="timeline section" id="perjalanan"><div className="container"><div className="section-title"><span>PERJALANAN KAMI</span><h2>Timeline Omah Berkah</h2><p>Perjalanan kami dalam memberikan manfaat kepada masyarakat Indonesia.</p></div><div className="timeline-wrapper">{data.timeline.map(t=><div className="timeline-item" key={t.id}><div className="timeline-year">{t.year}</div><div className="timeline-content"><h3>{t.title}</h3><p>{t.description}</p></div></div>)}</div></div></section>;
}

function GallerySection({limit}){
  const {data} = useSiteData();
  const user = getUser();
  const items = limit ? data.gallery.slice(0,limit) : data.gallery;
  const guestGate = !limit && !user;
  const GUEST_VISIBLE = 4;
  const visible = guestGate ? items.slice(0,GUEST_VISIBLE) : items;
  const locked = guestGate ? items.slice(GUEST_VISIBLE) : [];
  const [lightboxIndex,setLightboxIndex] = useState(null);
  const navLightbox = (dir)=> setLightboxIndex(i=> i===null?null : (i+dir+visible.length)%visible.length);
  const renderFigure = (g,i) => <figure key={g.id} onClick={()=>setLightboxIndex(i)}><img src={resolveImage(g.image)} alt={g.caption||'Galeri'}/><div className="gallery-zoom-icon"><i className="fa-solid fa-magnifying-glass-plus"/></div>{g.caption&&<figcaption>{g.caption}</figcaption>}</figure>;
  return <section className="gallery section" id="galeri"><div className="container"><div className="section-title"><span>GALERI</span><h2>Kegiatan Kami</h2><p>Dokumentasi kegiatan sosial bersama masyarakat.</p></div>{!limit && <div className="gallery-meta"><i className="fa-solid fa-camera"/> {items.length} foto kegiatan terdokumentasi</div>}<div className="gallery-grid">{visible.map((g,i)=>renderFigure(g,i))}</div>
  <LockedMore count={locked.length} gridClass="gallery-grid" label="Foto">{locked.map((g,i)=><figure key={g.id}><img src={resolveImage(g.image)} alt=""/></figure>)}</LockedMore>
  {limit && data.gallery.length>limit && <div className="section-cta"><Link to="/galeri" className="btn-outline">Lihat Semua Foto</Link></div>}</div>
  {lightboxIndex!==null && <Lightbox items={visible} index={lightboxIndex} onClose={()=>setLightboxIndex(null)} onNav={navLightbox}/>}
  </section>;
}

function TestimonialSection(){
  const {data} = useSiteData();
  return <section className="testimonial section"><div className="container"><div className="section-title"><span>TESTIMONI</span><h2>Apa Kata Mereka?</h2><p>Kepercayaan masyarakat menjadi motivasi kami untuk terus memberikan manfaat.</p></div><div className="testimonial-grid">{data.testimonials.map(t=><div className="testimonial-card" key={t.id}><img src={t.image?resolveImage(t.image):asset('user 3.jpeg')} alt={t.name}/><h3>{t.name}</h3><span>{t.role}</span><p>{t.quote}</p></div>)}</div></div></section>;
}

function CtaBanner({title="Siap Menjadi Bagian dari Kebaikan?", subtitle="Setiap donasi dan uluran tangan kamu berarti besar bagi masyarakat yang membutuhkan.", primaryLabel="Donasi Sekarang"}){
  const {openModal} = useDonate();
  return <section className="cta-banner"><div className="container cta-inner"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="cta-actions"><button className="btn-primary" onClick={()=>openModal()}>{primaryLabel}</button><Link to="/kontak" className="btn-outline-white">Hubungi Kami</Link></div></div></section>;
}

function QuickStats(){
  const {data} = useSiteData();
  if(!data.stats.length) return null;
  return <section className="quick-stats"><div className="container quick-stats-grid">{data.stats.map(s=><div className="quick-stat" key={s.id}><h3><AnimatedNumber value={s.value}/>{s.suffix}</h3><span>{s.label}</span></div>)}</div></section>;
}

const CORE_VALUES = [
 ['fa-hand-holding-heart','Empati','Kami mendengarkan dan memahami kebutuhan nyata masyarakat sebelum bertindak.'],
 ['fa-people-group','Kolaborasi','Bekerja sama dengan warga, relawan, dan mitra untuk hasil yang berkelanjutan.'],
 ['fa-scale-balanced','Transparansi','Setiap donasi dan program dikelola secara terbuka dan dapat dipertanggungjawabkan.'],
 ['fa-leaf','Keberlanjutan','Program dirancang agar manfaatnya terus dirasakan dalam jangka panjang.'],
];
function CoreValuesSection(){
  return <section className="values section"><div className="container"><div className="section-title"><span>NILAI KAMI</span><h2>Prinsip yang Kami Pegang</h2></div><div className="values-grid">{CORE_VALUES.map(v=><div className="value-card" key={v[1]}><i className={`fa-solid ${v[0]}`}/><h4>{v[1]}</h4><p>{v[2]}</p></div>)}</div></div></section>;
}

const FAQ_ITEMS = [
 ['Bagaimana cara berdonasi ke Omah Berkah?','Klik tombol "Donasi" di halaman manapun, pilih program yang ingin didukung, lalu ikuti instruksi pembayaran yang tersedia.'],
 ['Apakah donasi saya bisa dilacak penggunaannya?','Ya, setiap donasi yang masuk dicatat dan penggunaannya dilaporkan secara berkala melalui halaman statistik dan program.'],
 ['Bisakah saya menjadi relawan?','Tentu! Kirim pesan lewat formulir di halaman ini dengan subjek "Relawan", tim kami akan menghubungimu.'],
 ['Di mana lokasi kegiatan Omah Berkah?','Sebagian besar kegiatan berpusat di Malang, Jawa Timur, dengan program Kawi Farm di kaki Gunung Kawi.'],
];
function FaqSection(){
 const [open,setOpen]=useState(0);
 return <section className="faq section"><div className="container"><div className="section-title"><span>FAQ</span><h2>Pertanyaan yang Sering Ditanyakan</h2></div><div className="faq-list">{FAQ_ITEMS.map((f,i)=><div className={`faq-item ${open===i?'open':''}`} key={i}><button className="faq-question" onClick={()=>setOpen(open===i?-1:i)}>{f[0]}<i className="fa-solid fa-chevron-down"/></button><div className="faq-answer"><p>{f[1]}</p></div></div>)}</div></div></section>;
}

function ContactSection(){
  const [contact,setContact]=useState({name:'',email:'',subject:'',message:''});
  const [status,setStatus]=useState('');
  const submitContact=async e=>{e.preventDefault();try{await api('/messages',{method:'POST',body:contact});setStatus('ok');setContact({name:'',email:'',subject:'',message:''})}catch(e){alert(e.message)}};
  return <section className="contact-form-section" id="kontak"><div className="container"><div className="section-title"><span>HUBUNGI KAMI</span><h2>Kirim Pesan</h2><p>Ada pertanyaan, ingin jadi relawan, atau mengajak kolaborasi? Kirimkan pesan, tim kami akan segera membalas.</p></div><div className="contact-form-wrapper"><div className="contact-info-card"><h3>Ngobrol Langsung</h3><p>Kami senang mendengar dari kamu. Hubungi kami lewat kontak berikut.</p><div className="contact-info-item"><i className="fa-solid fa-location-dot"/><div><strong>Alamat</strong><br/>Malang, Jawa Timur</div></div><div className="contact-info-item"><i className="fa-solid fa-phone"/><div><strong>Telepon</strong><br/>+62 822-6418-3926</div></div><div className="contact-info-item"><i className="fa-solid fa-envelope"/><div><strong>Email</strong><br/>info@omahberkah.org</div></div></div><div className="contact-form-card"><h3>Formulir Pesan</h3>{status==='ok' ? <p className="form-success"><i className="fa-solid fa-circle-check"/> Pesan berhasil dikirim. Tim kami akan segera membalas.</p> : <form onSubmit={submitContact}><div className="form-row"><div className="form-group"><label>Nama</label><input value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})} required/></div><div className="form-group"><label>Email</label><input type="email" value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})} required/></div></div><div className="form-group"><label>Subjek</label><input value={contact.subject} onChange={e=>setContact({...contact,subject:e.target.value})}/></div><div className="form-group"><label>Pesan</label><textarea value={contact.message} onChange={e=>setContact({...contact,message:e.target.value})} required/></div><button className="btn-submit">Kirim Pesan</button></form>}</div></div></div></section>;
}

function MemberWelcomeStrip(){
  const user = getUser();
  const [summary,setSummary] = useState(null);
  useEffect(()=>{
    if(!user || user.role==='admin') return;
    api('/donations/mine',{auth:true}).then(d=>{
      const confirmed = d.items.filter(x=>x.status==='confirmed');
      setSummary({ total: confirmed.reduce((s,x)=>s+Number(x.amount),0), count: d.items.length });
    }).catch(()=>{});
  },[]);
  if(!user || user.role==='admin') return null;
  return <section className="member-welcome"><div className="container member-welcome-inner">
    <div className="member-welcome-text"><span className="member-badge"><i className="fa-solid fa-id-badge"/> {user.member_no || 'Anggota Omah Berkah'}</span><h2>Halo, {user.fullname.split(' ')[0]}!</h2>
    <p>{summary ? (summary.count>0 ? <>Kamu sudah mengajukan <strong>{summary.count} donasi</strong>, dengan total <strong>{rupiah(summary.total)}</strong> terkonfirmasi. Terima kasih atas kebaikanmu.</> : 'Belum ada donasi tercatat di akunmu — yuk mulai berbagi kebaikan hari ini.') : 'Memuat ringkasan akunmu...'}</p></div>
    <div className="member-welcome-actions"><Link to="/riwayat-donasi" className="btn-outline">Riwayat Donasi</Link></div>
  </div></section>;
}

function ImpactReportSection(){
  const user = getUser();
  const [impact,setImpact] = useState(null);
  useEffect(()=>{ api('/donations/impact',{auth:!!user}).then(setImpact).catch(()=>{}); },[]);
  if(!impact) return null;
  const maxTotal = impact.programs.reduce((m,p)=>Math.max(m,Number(p.total||0)),0) || 1;
  return <section className="impact-report section"><div className="container">
    <div className="section-title"><span>TRANSPARANSI</span><h2>Laporan Dampak Donasi</h2><p>Ke mana saja donasi yang terkumpul disalurkan, per program.</p></div>
    <div className={`impact-report-body ${impact.locked?'is-locked':''}`}>
      <div className="impact-list">
        {impact.programs.map(p=><div className="impact-row" key={p.id}>
          <div className="impact-row-top"><span>{p.title}</span>{!impact.locked && <strong>{rupiah(p.total)}</strong>}</div>
          <div className="impact-bar"><div className="impact-bar-fill" style={{width: impact.locked ? '55%' : `${Math.max(6,(Number(p.total)/maxTotal)*100)}%`}}/></div>
          {!impact.locked && <span className="impact-donor-count">{p.donor_count} donasi terkonfirmasi</span>}
        </div>)}
      </div>
      {impact.locked && <div className="impact-lock-overlay">
        <i className="fa-solid fa-lock"/>
        <h4>Masuk untuk melihat rincian lengkap</h4>
        <p>Total <strong>{rupiah(impact.total)}</strong> telah terkumpul dari <strong>{impact.donor_count}</strong> donasi. Masuk ke akunmu untuk melihat nominal per program.</p>
        <Link to="/login" className="btn-primary">Masuk Sekarang</Link>
      </div>}
    </div>
  </div></section>;
}

/* ================= Pages ================= */
function Landing(){
  const {loading,error} = useSiteData();
  if(loading) return <main className="page-loading"><div className="spinner"/><p>Memuat...</p></main>;
  return <main>
    <HeroSection/>
    <MemberWelcomeStrip/>
    <AboutSection/>
    <ProgramSection limit={3}/>
    <ImpactReportSection/>
    <GallerySection limit={6}/>
    <TestimonialSection/>
    <CtaBanner/>
    {error&&<div className="toast-container"><div className="toast show">API: {error}</div></div>}
  </main>;
}

function AboutPage(){ return <main data-variant="forest"><PageBanner eyebrow="TENTANG KAMI" title="Mengenal LSM Omah Berkah" subtitle="Lembaga sosial yang bergerak untuk pendidikan, kesehatan, dan pemberdayaan masyarakat." icon="fa-seedling" variant="forest"/><QuickStats/><AboutSection/></main>; }
function VisiMisiPage(){ return <main data-variant="forest"><PageBanner eyebrow="VISI & MISI" title="Komitmen Kami" subtitle="Arah dan tujuan yang kami perjuangkan bersama masyarakat." icon="fa-compass" variant="forest"/><VisiMisiSection/><CoreValuesSection/></main>; }
function ProgramPage(){ return <main data-variant="forest"><PageBanner eyebrow="PROGRAM KAMI" title="Program & Kegiatan" subtitle="Berbagai program sosial yang telah dan sedang kami jalankan." icon="fa-hands-holding-child" variant="forest"/><ProgramSection/><CtaBanner title="Dukung Program yang Kamu Percaya" subtitle="Pilih program yang paling menyentuh hatimu dan mulai berkontribusi hari ini." primaryLabel="Donasi Sekarang"/></main>; }
function TimelinePage(){ return <main data-variant="forest"><PageBanner eyebrow="PERJALANAN KAMI" title="Perjalanan Omah Berkah" subtitle="Jejak langkah kami dari waktu ke waktu." icon="fa-route" variant="forest"/><TimelineSection/><CtaBanner title="Jadi Bagian dari Cerita Selanjutnya" subtitle="Setiap langkah kami dimungkinkan oleh dukungan orang-orang seperti kamu." primaryLabel="Ikut Berkontribusi"/></main>; }
function GalleryPage(){ return <main data-variant="forest"><PageBanner eyebrow="GALERI" title="Dokumentasi Kegiatan" subtitle="Momen-momen kegiatan sosial bersama masyarakat." icon="fa-images" variant="forest"/><GallerySection/><CtaBanner title="Ingin Momen Baik Ini Terus Berlanjut?" subtitle="Dukungan kamu membantu kami menjangkau lebih banyak masyarakat." primaryLabel="Donasi Sekarang"/></main>; }
function ContactPage(){ return <main data-variant="forest"><PageBanner eyebrow="KONTAK" title="Hubungi Kami" subtitle="Kami senang mendengar dari kamu." icon="fa-paper-plane" variant="forest"/><ContactSection/><FaqSection/></main>; }

const INTEREST_OPTIONS = [
 {id:'pendidikan', label:'Pendidikan'},
 {id:'kesehatan', label:'Kesehatan'},
 {id:'lingkungan', label:'Lingkungan'},
 {id:'kawi-farm', label:'Kawi Farm'},
 {id:'umum', label:'Semua Bidang'},
];
const MEMBER_BENEFITS = [
 ['fa-id-badge','Kartu Anggota Digital','Dapatkan nomor anggota resmi Omah Berkah.'],
 ['fa-chart-line','Laporan Dampak Lengkap','Lihat rincian penyaluran donasi tanpa batas.'],
 ['fa-clock-rotate-left','Riwayat Donasi Tersimpan','Pantau semua kontribusimu di satu tempat.'],
 ['fa-bell','Info Program Terbaru','Jadi yang pertama tahu kegiatan & program baru.'],
];

function AuthPage({register=false}){
 const nav=useNavigate();
 const [form,setForm]=useState({fullname:'',email:'',password:'',confirmPassword:'',phone:'',domicile:'',interest:'umum'});
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const [joined,setJoined]=useState(null); // holds user after successful registration
 const submit=async e=>{
  e.preventDefault(); setError('');
  if(register&&form.password!==form.confirmPassword){setError('Konfirmasi kata sandi tidak sama.');return}
  setLoading(true);
  try{
   const d=await api(`/auth/${register?'register':'login'}`,{method:'POST',body:register?{fullname:form.fullname,email:form.email,password:form.password,phone:form.phone,domicile:form.domicile,interest:form.interest}:{email:form.email,password:form.password}});
   saveSession(d.token,d.user);
   if(register){ setJoined(d.user); } else { nav(d.user.role==='admin'?'/admin':'/'); }
  }catch(e){ setError(e.message); }
  finally{ setLoading(false); }
 };

 if(joined) return <div className="auth-page member-welcome-page">
  <div className="member-card">
   <div className="member-card-top"><i className="fa-solid fa-leaf"/><span>OMAH BERKAH</span></div>
   <div className="member-card-body">
    <span className="member-card-label">Kartu Anggota</span>
    <h2>{joined.fullname}</h2>
    <span className="member-card-no">{joined.member_no}</span>
   </div>
   <div className="member-card-bottom"><span>Bergabung {new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span></div>
  </div>
  <h1>Selamat Datang di Keluarga Omah Berkah!</h1>
  <p>Kamu resmi menjadi anggota dengan nomor <strong>{joined.member_no}</strong>. Terima kasih sudah bergabung untuk berbuat kebaikan bersama kami.</p>
  <button className="btn-submit" style={{maxWidth:280}} onClick={()=>nav('/')}>Lanjutkan ke Beranda</button>
 </div>;

 if(!register) return <div className="auth-page"><div className="auth-card"><Link to="/" className="auth-brand"><img src={asset('logo-green-cropped.png')} alt="Omah Berkah"/></Link><h1>Selamat datang kembali</h1><p>Masuk untuk melanjutkan.</p>{error&&<div className="auth-error">{error}</div>}<form onSubmit={submit}><label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Kata sandi<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required minLength="8"/></label><button disabled={loading}>{loading?'Memproses...':'Masuk'}</button></form><p>Belum punya akun? <Link to="/register">Daftar</Link></p></div></div>;

 return <div className="auth-page join-page-outer">
  <div className="join-page">
  <div className="join-benefits">
   <Link to="/" className="auth-brand"><img src={asset('logo-white-cropped.png')} alt="Omah Berkah"/></Link>
   <span className="join-eyebrow">GABUNG JADI ANGGOTA</span>
   <h1>Jadi Bagian dari Keluarga Omah Berkah</h1>
   <p>Bergabung sebagai anggota berarti ikut ambil bagian dalam setiap langkah kebaikan yang kami jalankan bersama masyarakat.</p>
   <div className="benefits-list">
    {MEMBER_BENEFITS.map(b=><div className="benefit-item" key={b[1]}><i className={`fa-solid ${b[0]}`}/><div><h4>{b[1]}</h4><p>{b[2]}</p></div></div>)}
   </div>
  </div>
  <div className="auth-card join-form-card">
   <h1>Formulir Pendaftaran Anggota</h1>
   <p>Lengkapi data diri kamu untuk mendapatkan nomor anggota resmi.</p>
   {error&&<div className="auth-error">{error}</div>}
   <form onSubmit={submit}>
    <label>Nama lengkap<input value={form.fullname} onChange={e=>setForm({...form,fullname:e.target.value})} required minLength="3" placeholder="Sesuai identitas"/></label>
    <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required placeholder="nama@contoh.com"/></label>
    <label>No. WhatsApp<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="08xxxxxxxxxx"/></label>
    <label>Domisili (Kota)<input value={form.domicile} onChange={e=>setForm({...form,domicile:e.target.value})} placeholder="Contoh: Malang"/></label>
    <label>Bidang yang Diminati<select value={form.interest} onChange={e=>setForm({...form,interest:e.target.value})}>{INTEREST_OPTIONS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
    <label>Kata sandi<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required minLength="8"/></label>
    <label>Konfirmasi kata sandi<input type="password" value={form.confirmPassword} onChange={e=>setForm({...form,confirmPassword:e.target.value})} required/></label>
    <button disabled={loading}>{loading?'Mendaftarkan...':'Gabung Sekarang'}</button>
   </form>
   <p>Sudah punya akun? <Link to="/login">Masuk</Link></p>
  </div>
  </div>
 </div>;
}

/* ================= Admin dashboard ================= */
const ADMIN_TABS = [
 {key:'overview', label:'Ringkasan', icon:'fa-gauge-high', group:'main'},
 {key:'programs', label:'Program', icon:'fa-hands-holding-child', group:'content'},
 {key:'gallery', label:'Galeri', icon:'fa-images', group:'content'},
 {key:'testimonials', label:'Testimoni', icon:'fa-comment-dots', group:'content'},
 {key:'timeline', label:'Linimasa', icon:'fa-timeline', group:'content'},
 {key:'stats', label:'Statistik', icon:'fa-chart-simple', group:'content'},
 {key:'messages', label:'Pesan', icon:'fa-envelope', group:'interaction'},
 {key:'donations', label:'Donasi', icon:'fa-hand-holding-heart', group:'interaction'},
];
const CONTENT_CONFIGS = {
 programs:{title:'Program',fields:['title','description','image','icon','target_amount'],primary:'title',secondary:'description',image:'image'},
 gallery:{title:'Galeri',fields:['image','caption'],primary:'caption',secondary:null,image:'image'},
 testimonials:{title:'Testimoni',fields:['name','role','quote','image'],primary:'name',secondary:'quote',image:'image'},
 timeline:{title:'Linimasa',fields:['year','title','description'],primary:'title',secondary:'description',image:null},
 stats:{title:'Statistik',fields:['label','value','suffix'],primary:'label',secondary:null,image:null},
};

function Admin(){
 const nav=useNavigate(), user=getUser();
 const [tab,setTab]=useState('overview');
 const [items,setItems]=useState([]);
 const [overview,setOverview]=useState(null);
 const [loading,setLoading]=useState(false);
 const [err,setErr]=useState('');
 const [modal,setModal]=useState(null); // {mode:'add'|'edit', item}

 const loadOverview=async()=>{
  setLoading(true);
  try{
   const [programs,gallery,testimonials,messages,donations]=await Promise.all([
    api('/programs'),api('/gallery'),api('/testimonials'),api('/messages',{auth:true}),api('/donations',{auth:true})
   ]);
   const unread=messages.items.filter(m=>!m.is_read).length;
   const pending=donations.items.filter(d=>d.status==='pending').length;
   const confirmedTotal=donations.items.filter(d=>d.status==='confirmed').reduce((s,d)=>s+Number(d.amount),0);
   setOverview({programs:programs.items.length,gallery:gallery.items.length,testimonials:testimonials.items.length,unread,pending,confirmedTotal});
   setErr('');
  }catch(e){ setErr(e.message); }
  finally{ setLoading(false); }
 };

 const load=async()=>{
  setLoading(true);
  try{ const d=await api('/'+tab,{auth:true}); setItems(d.items||[]); setErr(''); }
  catch(e){ setErr(e.message); }
  finally{ setLoading(false); }
 };

 useEffect(()=>{
  if(!user||user.role!=='admin'){ nav('/login'); return; }
  if(tab==='overview') loadOverview();
  else load();
 },[tab]);

 const save=async item=>{
  try{
   if(item.id) await api(`/${tab}/${item.id}`,{method:'PUT',body:item,auth:true});
   else await api('/'+tab,{method:'POST',body:item,auth:true});
   setModal(null);
   load();
  }catch(e){ alert(e.message); }
 };
 const del=async id=>{
  if(!confirm('Hapus data ini?'))return;
  try{ await api(`/${tab}/${id}`,{method:'DELETE',auth:true}); load(); }
  catch(e){ alert(e.message); }
 };
 const msgAct=async(id,is_read)=>{ await api(`/messages/${id}`,{method:'PATCH',body:{is_read},auth:true}); load(); };
 const donAct=async(id,status)=>{ await api(`/donations/${id}`,{method:'PATCH',body:{status},auth:true}); load(); };

 const currentTitle = ADMIN_TABS.find(t=>t.key===tab)?.label || '';

 return <div className="admin-react">
  <aside>
   <h2><i className="fa-solid fa-leaf"/> Omah Berkah</h2>
   <div className="admin-nav-group">
    {ADMIN_TABS.filter(t=>t.group==='main').map(t=><button key={t.key} className={tab===t.key?'active':''} onClick={()=>setTab(t.key)}><i className={`fa-solid ${t.icon}`}/>{t.label}</button>)}
   </div>
   <div className="admin-nav-label">Konten</div>
   <div className="admin-nav-group">
    {ADMIN_TABS.filter(t=>t.group==='content').map(t=><button key={t.key} className={tab===t.key?'active':''} onClick={()=>setTab(t.key)}><i className={`fa-solid ${t.icon}`}/>{t.label}</button>)}
   </div>
   <div className="admin-nav-label">Interaksi</div>
   <div className="admin-nav-group">
    {ADMIN_TABS.filter(t=>t.group==='interaction').map(t=><button key={t.key} className={tab===t.key?'active':''} onClick={()=>setTab(t.key)}><i className={`fa-solid ${t.icon}`}/>{t.label}{t.key==='messages'&&overview?.unread>0&&<span className="admin-badge">{overview.unread}</span>}</button>)}
   </div>
   <div className="admin-sidebar-footer">
    <div className="admin-mini-user"><span className="avatar">{(user?.fullname||'?')[0].toUpperCase()}</span><span>{user?.fullname}</span></div>
    <button onClick={()=>{clearSession();nav('/')}}><i className="fa-solid fa-arrow-right-from-bracket"/> Keluar</button>
   </div>
  </aside>

  <main>
   <div className="admin-top">
    <div><small>Dashboard Admin</small><h1>{currentTitle}</h1></div>
    <Link to="/"><i className="fa-solid fa-arrow-up-right-from-square"/> Lihat Website</Link>
   </div>

   {err&&<p className="auth-error">{err}</p>}

   {loading ? <div className="admin-loading"><div className="spinner"/><p>Memuat data...</p></div> :
    tab==='overview' ? <AdminOverview data={overview}/> :
    tab==='messages' ? <AdminMessages items={items} onAct={msgAct}/> :
    tab==='donations' ? <AdminDonations items={items} onAct={donAct}/> :
    <AdminContentTable items={items} config={CONTENT_CONFIGS[tab]} onAdd={()=>setModal({mode:'add',item:Object.fromEntries(CONTENT_CONFIGS[tab].fields.map(k=>[k,'']))})} onEdit={item=>setModal({mode:'edit',item:{...item}})} onDelete={del}/>}
  </main>

  {modal && <ContentFormModal config={CONTENT_CONFIGS[tab]} mode={modal.mode} item={modal.item} onSave={save} onClose={()=>setModal(null)}/>}
 </div>;
}

function AdminOverview({data}){
 if(!data) return null;
 const cards=[
  {icon:'fa-hands-holding-child',label:'Program Aktif',value:data.programs},
  {icon:'fa-images',label:'Foto Galeri',value:data.gallery},
  {icon:'fa-comment-dots',label:'Testimoni',value:data.testimonials},
  {icon:'fa-envelope',label:'Pesan Belum Dibaca',value:data.unread,alert:data.unread>0},
  {icon:'fa-hourglass-half',label:'Donasi Menunggu',value:data.pending,alert:data.pending>0},
  {icon:'fa-sack-dollar',label:'Total Donasi Terverifikasi',value:rupiah(data.confirmedTotal),wide:true},
 ];
 return <div className="stat-cards">
  {cards.map(c=><div className={`stat-card ${c.alert?'alert':''} ${c.wide?'wide':''}`} key={c.label}>
   <div className="stat-icon"><i className={`fa-solid ${c.icon}`}/></div>
   <div><div className="stat-value">{c.value}</div><div className="stat-label">{c.label}</div></div>
  </div>)}
 </div>;
}

function AdminContentTable({items,config,onAdd,onEdit,onDelete}){
 return <div className="admin-panel">
  <div className="admin-panel-header">
   <div className="admin-panel-count">{items.length} data</div>
   <button className="btn-add" onClick={onAdd}><i className="fa-solid fa-plus"/> Tambah {config.title}</button>
  </div>
  {items.length===0 ? <div className="admin-empty"><i className="fa-solid fa-inbox"/><p>Belum ada data. Klik "Tambah {config.title}" untuk menambahkan.</p></div> :
  <div className="admin-table-wrap"><table>
   <thead><tr>{config.image&&<th className="th-thumb"></th>}<th>{config.primary}</th>{config.secondary&&<th>{config.secondary}</th>}<th className="th-actions">Aksi</th></tr></thead>
   <tbody>{items.map(item=><tr key={item.id}>
    {config.image&&<td className="td-thumb">{item[config.image]?<img src={resolveImage(item[config.image])} alt=""/>:<div className="td-thumb-empty"><i className="fa-solid fa-image"/></div>}</td>}
    <td className="td-primary">{item[config.primary]||'-'}</td>
    {config.secondary&&<td className="td-secondary">{(item[config.secondary]||'').slice(0,90)}{(item[config.secondary]||'').length>90?'…':''}</td>}
    <td className="td-actions"><button className="icon-btn" onClick={()=>onEdit(item)}><i className="fa-solid fa-pen"/></button><button className="icon-btn danger" onClick={()=>onDelete(item.id)}><i className="fa-solid fa-trash"/></button></td>
   </tr>)}</tbody>
  </table></div>}
 </div>;
}

function ImageField({label,value,onChange}){
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const inputRef=useRef(null);
 const handleFile=async(e)=>{
  const file=e.target.files?.[0];
  if(!file) return;
  setError(''); setUploading(true);
  try{
   const url=await uploadImage(file);
   onChange(url);
  }catch(err){ setError(err.message||'Gagal mengunggah gambar.'); }
  finally{ setUploading(false); if(inputRef.current) inputRef.current.value=''; }
 };
 return <div className="form-group">
  <label style={{textTransform:'capitalize'}}>{label}</label>
  {value && <div className="image-field-preview"><img src={resolveImage(value)} alt=""/></div>}
  <div className="image-field-row">
   <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" ref={inputRef} onChange={handleFile} disabled={uploading}/>
   {uploading && <span className="image-field-status"><i className="fa-solid fa-spinner fa-spin"/> Mengunggah...</span>}
  </div>
  <input className="image-field-url" placeholder="atau tempel URL gambar di sini" value={value||''} onChange={e=>onChange(e.target.value)}/>
  {error && <p className="image-field-error">{error}</p>}
 </div>;
}

function ContentFormModal({config,mode,item,onSave,onClose}){
 const [form,setForm]=useState(item);
 const set=(k,v)=>setForm(f=>({...f,[k]:v}));
 return <div className="modal-overlay" style={{display:'flex'}} onClick={e=>e.target===e.currentTarget&&onClose()}>
  <div className="modal-box">
   <button className="modal-close" onClick={onClose}><i className="fa-solid fa-xmark"/></button>
   <h3>{mode==='add'?'Tambah':'Edit'} {config.title}</h3>
   <form onSubmit={e=>{e.preventDefault();onSave(form);}}>
    {config.fields.map(k=>
     k===config.image ?
     <ImageField key={k} label={k} value={form[k]} onChange={v=>set(k,v)}/> :
     k==='description'||k==='quote' ?
     <div className="form-group" key={k}><label style={{textTransform:'capitalize'}}>{k}</label><textarea value={form[k]||''} onChange={e=>set(k,e.target.value)}/></div> :
     k==='target_amount' ?
     <div className="form-group" key={k}><label>Target Donasi (Rp) <span className="form-hint">opsional — kosongkan jika tidak pakai progress bar</span></label><input type="number" min="0" value={form[k]||''} onChange={e=>set(k,e.target.value)} placeholder="misal: 10000000"/></div> :
     <div className="form-group" key={k}><label style={{textTransform:'capitalize'}}>{k}</label><input value={form[k]||''} onChange={e=>set(k,e.target.value)}/></div>
    )}
    <button className="btn-submit">Simpan</button>
   </form>
  </div>
 </div>;
}

function AdminMessages({items,onAct}){
 if(items.length===0) return <div className="admin-empty"><i className="fa-solid fa-inbox"/><p>Belum ada pesan masuk.</p></div>;
 return <div className="admin-panel"><div className="admin-list-cards">{items.map(m=>
  <div className={`admin-card ${!m.is_read?'unread':''}`} key={m.id}>
   <div className="admin-card-top">
    <div><b>{m.name}</b><span className="admin-card-sub">{m.email}</span></div>
    {!m.is_read && <span className="status-badge new">Baru</span>}
   </div>
   {m.subject && <p className="admin-card-subject">{m.subject}</p>}
   <p className="admin-card-body">{m.message}</p>
   <div className="admin-card-actions"><button className="btn-ghost" onClick={()=>onAct(m.id,!m.is_read)}>{m.is_read?'Tandai belum dibaca':'Tandai dibaca'}</button></div>
  </div>
 )}</div></div>;
}

function AdminDonations({items,onAct}){
 if(items.length===0) return <div className="admin-empty"><i className="fa-solid fa-inbox"/><p>Belum ada pengajuan donasi.</p></div>;
 return <div className="admin-panel"><div className="admin-list-cards">{items.map(d=>
  <div className="admin-card" key={d.id}>
   <div className="admin-card-top">
    <div><b>{d.name}</b><span className="admin-card-sub">{d.email} · {d.program_title||'Umum'}</span></div>
    <span className={`status-badge ${d.status}`}>{d.status}</span>
   </div>
   <p className="admin-card-amount">{rupiah(d.amount)}</p>
   <div className="admin-card-actions">
    <button className="btn-ghost" onClick={()=>onAct(d.id,'confirmed')}>Konfirmasi</button>
    <button className="btn-ghost danger" onClick={()=>onAct(d.id,'cancelled')}>Batalkan</button>
   </div>
  </div>
 )}</div></div>;
}

/* ================= App root ================= */
const DONATION_STATUS_LABEL = { pending:'Menunggu Konfirmasi', confirmed:'Terkonfirmasi', cancelled:'Dibatalkan' };
function MyDonationsPage(){
 const user = getUser();
 const [items,setItems] = useState(null);
 const [error,setError] = useState('');
 useEffect(()=>{
  if(!user){ return; }
  api('/donations/mine',{auth:true}).then(d=>setItems(d.items)).catch(e=>setError(e.message));
 },[]);
 if(!user) return <main data-variant="forest"><PageBanner eyebrow="AKUN SAYA" title="Riwayat Donasi" subtitle="Masuk untuk melihat riwayat donasimu." icon="fa-receipt" variant="forest"/><div className="container section" style={{textAlign:'center'}}><p>Kamu perlu masuk terlebih dahulu.</p><Link to="/login" className="btn-primary">Masuk</Link></div></main>;
 const total = (items||[]).filter(d=>d.status==='confirmed').reduce((s,d)=>s+Number(d.amount),0);
 return <main data-variant="forest">
  <PageBanner eyebrow="AKUN SAYA" title={`Halo, ${user.fullname.split(' ')[0]}`} subtitle="Ini riwayat donasi yang pernah kamu ajukan lewat akun ini." icon="fa-receipt" variant="forest"/>
  <QuickStats/>
  <section className="section container">
   {error && <p className="form-error">{error}</p>}
   {items===null && !error && <p>Memuat riwayat donasi...</p>}
   {items && items.length===0 && <div className="empty-state"><i className="fa-solid fa-hand-holding-heart"/><p>Belum ada donasi yang tercatat di akun ini.</p></div>}
   {items && items.length>0 && <>
    <p className="my-donations-summary">Total donasi terkonfirmasi: <strong>{rupiah(total)}</strong></p>
    <div className="my-donations-list">
     {items.map(d=><div className="my-donation-item" key={d.id}>
      <div className="my-donation-main">
       <span className={`status-badge status-${d.status}`}>{DONATION_STATUS_LABEL[d.status]||d.status}</span>
       <h4>{d.program_title || 'Donasi Umum'}</h4>
       <p>{new Date(d.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</p>
      </div>
      <div className="my-donation-amount">{rupiah(d.amount)}</div>
     </div>)}
    </div>
   </>}
  </section>
 </main>;
}

export default function App(){
 return <BrowserRouter>
  <SiteDataProvider>
   <DonateProvider>
    <Routes>
     <Route element={<Layout/>}>
      <Route path="/" element={<Landing/>}/>
      <Route path="/tentang" element={<AboutPage/>}/>
      <Route path="/visi-misi" element={<VisiMisiPage/>}/>
      <Route path="/program" element={<ProgramPage/>}/>
      <Route path="/perjalanan" element={<TimelinePage/>}/>
      <Route path="/galeri" element={<GalleryPage/>}/>
      <Route path="/kontak" element={<ContactPage/>}/>
      <Route path="/riwayat-donasi" element={<MyDonationsPage/>}/>
     </Route>
     <Route path="/login" element={<AuthPage/>}/>
     <Route path="/register" element={<AuthPage register/>}/>
     <Route path="/admin" element={<Admin/>}/>
    </Routes>
   </DonateProvider>
  </SiteDataProvider>
 </BrowserRouter>;
}
