import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, LayoutDashboard, LogOut, MapPin, Menu, Navigation, ParkingSquare, Plus, Search, ShieldCheck, SlidersHorizontal, Trash2, UserRound, Wallet, X } from 'lucide-react';
import { api } from './api';
import { distanceKm, loadGoogleMaps } from './maps';
import './styles.css';

const center = { lat: -27.5954, lng: -48.5480 };
const roleText = { Driver: 'Motorista', Owner: 'Proprietário', Admin: 'Administrador' };
const pricingText = { Hourly: '/ hora', Daily: '/ diária', Fixed: '/ reserva' };
const days = [
  ['Sunday', 'Dom'], ['Monday', 'Seg'], ['Tuesday', 'Ter'], ['Wednesday', 'Qua'],
  ['Thursday', 'Qui'], ['Friday', 'Sex'], ['Saturday', 'Sáb'],
];
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const dateTime = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const initialSchedule = { mode: 'weekly', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], date: today(), start: '08:00', end: '18:00' };

function Brand({ small = false }) {
  return <div className={`brand ${small ? 'brand-small' : ''}`}><span className="brand-mark"><span /></span><span>loop<span className="brand-dot">.</span></span></div>;
}

function App() {
  const [users, setUsers] = useState([]);
  const [spots, setSpots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('explore');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [signup, setSignup] = useState({ name: '', email: '', role: 'Driver' });
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [destination, setDestination] = useState(center);
  const [destinationName, setDestinationName] = useState('Centro, Florianópolis');
  const [searchText, setSearchText] = useState('');
  const [maxDistance, setMaxDistance] = useState(10);
  const [mapStatus, setMapStatus] = useState('loading');
  const [mapError, setMapError] = useState('');
  const [ownerForm, setOwnerForm] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  const refresh = async () => {
    const [userData, spotData, bookingData] = await Promise.all([api('/api/users'), api('/api/spots?includeInactive=true'), api('/api/bookings')]);
    setUsers(userData);
    setSpots(spotData);
    setBookings(bookingData);
  };
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setBusy(false)); }, []);
  useEffect(() => { if (toast) { const timeout = setTimeout(() => setToast(''), 4200); return () => clearTimeout(timeout); } }, [toast]);

  const visibleSpots = useMemo(() => spots.filter(s => s.isActive).map(s => ({ ...s, distance: distanceKm(destination, { lat: s.latitude, lng: s.longitude }) }))
    .filter(s => s.distance <= maxDistance).sort((a, b) => a.distance - b.distance), [spots, destination, maxDistance]);
  const ownSpots = spots.filter(s => s.ownerId === user?.id && s.isActive);
  const myBookings = bookings.filter(b => user?.role === 'Driver' ? b.driverId === user.id : user?.role === 'Owner' ? ownSpots.some(s => s.id === b.parkingSpotId) : true);

  async function handleSignup(event) {
    event.preventDefault();
    try {
      const created = await api('/api/users', { method: 'POST', body: signup });
      await refresh();
      setUser(created); setView(created.role === 'Owner' ? 'my-spots' : 'explore'); setShowSignup(false); setToast('Perfil criado com sucesso!');
    } catch (e) { setError(e.message); }
  }

  function login(selected) {
    setUser(selected); setView(selected.role === 'Owner' ? 'my-spots' : selected.role === 'Admin' ? 'admin' : 'explore'); setError('');
  }

  async function saveSpot(payload, id) {
    await api(id ? `/api/spots/${id}` : '/api/spots', { method: id ? 'PUT' : 'POST', body: payload });
    await refresh(); setOwnerForm(null); setToast(id ? 'Vaga atualizada.' : 'Vaga publicada com sucesso.');
  }

  async function deleteSpot(id) {
    if (!window.confirm('Desativar esta vaga? Ela deixará de aparecer na busca.')) return;
    try { await api(`/api/spots/${id}?ownerId=${user.id}`, { method: 'DELETE' }); await refresh(); setToast('Vaga desativada.'); }
    catch (e) { setError(e.message); }
  }

  async function reserve(spot, start, end) {
    await api('/api/bookings', { method: 'POST', body: { parkingSpotId: spot.id, driverId: user.id, startsAtUtc: start, endsAtUtc: end } });
    await refresh(); setSelectedSpot(null); setToast('Reserva confirmada! Você pode consultá-la em Minhas reservas.');
  }

  async function cancelBooking(id) {
    if (!window.confirm('Cancelar esta reserva?')) return;
    try { await api(`/api/bookings/${id}?driverId=${user.id}`, { method: 'DELETE' }); await refresh(); setToast('Reserva cancelada.'); }
    catch (e) { setError(e.message); }
  }

  function navigation(target) { setView(target); setMobileMenu(false); setError(''); }

  if (busy) return <div className="loading-page"><Brand /><div className="spinner" />Carregando o Loop...</div>;

  if (!user) return <div className="login-page">
    <div className="login-visual"><div className="login-visual-inner"><Brand /><div className="login-art"><div className="art-road road-one" /><div className="art-road road-two" /><div className="art-parking"><ParkingSquare size={75} strokeWidth={1.4} /></div><div className="art-pin"><MapPin size={22} fill="currentColor" /></div><div className="art-card"><span className="art-card-icon"><Check size={16} /></span><span><strong>Seu lugar, encontrado.</strong><small>A cidade flui melhor com o Loop.</small></span></div></div><div><div className="eyebrow light">ESTACIONAR PODE SER SIMPLES</div><h1>Seu lugar<br />na cidade<span>.</span></h1><p>Encontre vagas perto de onde você precisa estar. Ou transforme um espaço livre em oportunidade.</p></div><div className="login-footer">LOOP © 2026 <span>•</span> PROJETO ACADÊMICO</div></div></div>
    <div className="login-panel"><div className="login-panel-inner"><div className="mobile-brand"><Brand /></div><div className="eyebrow">BEM-VINDO AO LOOP</div><h2>{showSignup ? 'Crie seu perfil' : 'Como você quer entrar?'}</h2><p className="login-subtitle">{showSignup ? 'Preencha seus dados para começar.' : 'Escolha um perfil de demonstração para explorar a plataforma.'}</p>
      {error && <div className="alert error-alert">{error}<button aria-label="Fechar erro" onClick={() => setError('')}><X size={16} /></button></div>}
      {showSignup ? <form className="signup-form" onSubmit={handleSignup}><label>Nome completo<input required maxLength="100" value={signup.name} onChange={e => setSignup({ ...signup, name: e.target.value })} placeholder="Seu nome" /></label><label>E-mail<input required type="email" value={signup.email} onChange={e => setSignup({ ...signup, email: e.target.value })} placeholder="voce@exemplo.com" /></label><label>Quero entrar como<select value={signup.role} onChange={e => setSignup({ ...signup, role: e.target.value })}><option value="Driver">Motorista</option><option value="Owner">Proprietário</option></select></label><button className="btn btn-primary full" type="submit">Criar perfil <ArrowRight size={17} /></button><button className="text-button" type="button" onClick={() => setShowSignup(false)}><ArrowLeft size={16} /> Voltar aos perfis de demonstração</button></form> : <><div className="profile-list">{['Driver', 'Owner', 'Admin'].map(role => { const demo = users.find(u => u.role === role); const Icon = role === 'Driver' ? Navigation : role === 'Owner' ? ParkingSquare : ShieldCheck; return <button key={role} className="profile-option" disabled={!demo} onClick={() => login(demo)}><span className={`profile-icon profile-${role.toLowerCase()}`}><Icon size={21} /></span><span className="profile-copy"><strong>{roleText[role]}</strong><small>{role === 'Driver' ? 'Buscar e reservar vagas' : role === 'Owner' ? 'Anunciar e gerenciar vagas' : 'Consultar dados da plataforma'}</small></span><ArrowRight className="profile-arrow" size={19} /></button>; })}</div><div className="login-divider"><span>ou</span></div><button className="btn btn-outline full" onClick={() => setShowSignup(true)}><Plus size={18} /> Criar novo perfil</button></>}
      <div className="demo-note"><CircleHelp size={17} /><span>Entrada fictícia para fins acadêmicos. Não há senha nem pagamento.</span></div>
    </div></div>
  </div>;

  const navItems = user.role === 'Driver' ? [['explore', 'Explorar vagas', Search], ['bookings', 'Minhas reservas', CalendarDays]] : user.role === 'Owner' ? [['my-spots', 'Minhas vagas', ParkingSquare], ['bookings', 'Reservas', CalendarDays]] : [['admin', 'Visão geral', LayoutDashboard]];

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}><div className="sidebar-top"><Brand small /><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X size={20} /></button></div><div className="sidebar-label">MENU PRINCIPAL</div><nav>{navItems.map(([id, label, Icon]) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigation(id)}><Icon size={19} /><span>{label}</span>{view === id && <span className="nav-active-dot" />}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><MapPin size={19} /></span><strong>Mais espaço para todos.</strong><p>Conectando pessoas e lugares na cidade.</p></div><button className="account-card" onClick={() => { setUser(null); setSelectedSpot(null); setOwnerForm(null); }}><span className="avatar">{user.name.charAt(0).toUpperCase()}</span><span><strong>{user.name}</strong><small>{roleText[user.role]}</small></span><LogOut size={17} /></button></div></aside>
    {mobileMenu && <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />}
    <main className="main"><header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu size={22} /></button><div className="breadcrumb">Loop <span>/</span> {navItems.find(x => x[0] === view)?.[1]}</div><div className="topbar-right"><span className="topbar-pill"><span className="online-dot" /> Plataforma ativa</span><span className="avatar top-avatar">{user.name.charAt(0).toUpperCase()}</span></div></header>
      {error && <div className="alert error-alert page-alert">{error}<button aria-label="Fechar erro" onClick={() => setError('')}><X size={16} /></button></div>}
      {view === 'explore' && <Explore spots={visibleSpots} allCount={spots.filter(s => s.isActive).length} destination={destination} destinationName={destinationName} searchText={searchText} setSearchText={setSearchText} setDestination={setDestination} setDestinationName={setDestinationName} maxDistance={maxDistance} setMaxDistance={setMaxDistance} mapStatus={mapStatus} setMapStatus={setMapStatus} mapError={mapError} setMapError={setMapError} onSelect={setSelectedSpot} onError={setError} />}
      {view === 'my-spots' && <OwnerDashboard spots={ownSpots} bookings={myBookings} onNew={() => setOwnerForm({})} onEdit={setOwnerForm} onDelete={deleteSpot} />}
      {view === 'bookings' && <BookingsView bookings={myBookings} role={user.role} onCancel={cancelBooking} />}
      {view === 'admin' && <AdminDashboard users={users} spots={spots} bookings={bookings} />}
    </main>
    {selectedSpot && <ReservationModal spot={selectedSpot} onClose={() => setSelectedSpot(null)} onReserve={reserve} />}
    {ownerForm && <SpotModal initial={ownerForm.id ? ownerForm : null} ownerId={user.id} onClose={() => setOwnerForm(null)} onSave={saveSpot} />}
    {toast && <div className="toast"><Check size={18} />{toast}<button onClick={() => setToast('')} aria-label="Fechar aviso"><X size={14} /></button></div>}
  </div>;
}

function Explore({ spots, allCount, destination, destinationName, searchText, setSearchText, setDestination, setDestinationName, maxDistance, setMaxDistance, mapStatus, setMapStatus, mapError, setMapError, onSelect, onError }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markerObjects = useRef([]);
  const destinationMarker = useRef(null);
  const [searchBusy, setSearchBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadGoogleMaps().then(maps => {
      if (!active || !mapContainer.current) return;
      map.current = new maps.Map(mapContainer.current, { center: destination, zoom: 13, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative', styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cde6e6' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f7f1' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      ] });
      setMapStatus('ready');
    }).catch(e => { if (active) { setMapStatus('error'); setMapError(e.message); } });
    return () => { active = false; markerObjects.current.forEach(m => m.setMap(null)); destinationMarker.current?.setMap(null); map.current = null; };
  }, []);

  useEffect(() => {
    if (mapStatus !== 'ready' || !map.current || !window.google?.maps) return;
    markerObjects.current.forEach(marker => marker.setMap(null));
    destinationMarker.current?.setMap(null);
    const maps = window.google.maps;
    destinationMarker.current = new maps.Marker({ map: map.current, position: destination, title: 'Seu destino', icon: { path: maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#f97347', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 4 } });
    markerObjects.current = spots.map(spot => {
      const marker = new maps.Marker({ map: map.current, position: { lat: Number(spot.latitude), lng: Number(spot.longitude) }, title: spot.title, label: { text: `R$${Math.round(Number(spot.price))}`, color: '#153b35', fontWeight: '700', fontSize: '12px' }, icon: { path: maps.SymbolPath.CIRCLE, scale: 27, fillColor: '#ffffff', fillOpacity: 1, strokeColor: '#d4e6df', strokeWeight: 1 } });
      marker.addListener('click', () => onSelect(spot));
      return marker;
    });
    map.current.panTo(destination);
  }, [mapStatus, spots, destination]);

  async function searchDestination(event) {
    event.preventDefault();
    if (!searchText.trim()) return;
    try {
      setSearchBusy(true);
      const maps = await loadGoogleMaps();
      const geocoder = new maps.Geocoder();
      const result = await geocoder.geocode({ address: searchText.trim(), region: 'BR' });
      if (!result.results?.length) throw new Error('Endereço não encontrado. Tente incluir cidade e estado.');
      const place = result.results[0];
      setDestination({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      setDestinationName(place.formatted_address);
    } catch (e) { onError(e.message); } finally { setSearchBusy(false); }
  }

  return <div className="page-content explore-page"><div className="page-heading"><div><div className="eyebrow">ENCONTRE O SEU LUGAR</div><h1>Para onde vamos hoje<span>?</span></h1><p>Vagas perto do seu destino, no horário que você precisa.</p></div></div>
    <form className="search-bar" onSubmit={searchDestination}><div className="search-input-wrap"><Search size={21} /><input aria-label="Buscar endereço de destino" placeholder="Busque um endereço, bairro ou ponto de referência" value={searchText} onChange={e => setSearchText(e.target.value)} /><span className="search-hint">Destino</span></div><button className="btn btn-primary" disabled={searchBusy}>{searchBusy ? 'Buscando...' : 'Buscar vagas'} <ArrowRight size={17} /></button></form>
    <div className="explore-layout"><section className="results-panel"><div className="results-header"><div><div className="section-kicker"><span className="pulse-dot" /> VAGAS DISPONÍVEIS</div><h2>{spots.length} {spots.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}</h2><p>Próximas de <strong>{destinationName}</strong></p></div><div className="filter-select"><SlidersHorizontal size={16} /><select aria-label="Distância máxima" value={maxDistance} onChange={e => setMaxDistance(Number(e.target.value))}><option value="2">Até 2 km</option><option value="5">Até 5 km</option><option value="10">Até 10 km</option><option value="25">Até 25 km</option><option value="100">Todas</option></select><ChevronDown size={14} /></div></div><div className="spot-list">{spots.length ? spots.map(spot => <button key={spot.id} className="spot-card" onClick={() => onSelect(spot)}><div className="spot-card-top"><span className="spot-icon"><ParkingSquare size={23} /></span><span className="spot-distance"><Navigation size={12} /> {spot.distance.toFixed(1).replace('.', ',')} km</span></div><h3>{spot.title}</h3><p className="spot-address"><MapPin size={14} />{spot.address}</p><div className="spot-card-bottom"><div><strong>{money(spot.price)}</strong><span>{pricingText[spot.pricingType]}</span></div><span className="card-arrow"><ArrowRight size={18} /></span></div></button>) : <div className="empty-state"><span><Search size={28} /></span><h3>Nenhuma vaga nesse raio</h3><p>{allCount ? 'Aumente a distância da busca ou procure outro destino.' : 'As vagas cadastradas aparecerão aqui.'}</p></div>}</div></section><section className="map-panel"><div ref={mapContainer} className="google-map" />{mapStatus !== 'ready' && <div className="map-fallback"><div className="fallback-grid" /><span className="fallback-pin"><MapPin size={30} fill="currentColor" /></span><div className="fallback-content"><span className="fallback-icon"><MapPin size={22} /></span><h3>{mapStatus === 'loading' ? 'Carregando mapa...' : 'Mapa ainda não configurado'}</h3><p>{mapStatus === 'loading' ? 'Conectando ao Google Maps.' : mapError}</p></div></div>}<div className="map-location"><span><Navigation size={15} /></span><div><small>EXPLORANDO PERTO DE</small><strong>{destinationName}</strong></div></div></section></div>
  </div>;
}

function ReservationModal({ spot, onClose, onReserve }) {
  const [date, setDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('11:00');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const duration = (new Date(`${endDate}T${end}`) - new Date(`${date}T${start}`)) / 3600000;
  const estimated = duration > 0 ? spot.pricingType === 'Hourly' ? Math.ceil(duration) * spot.price : spot.pricingType === 'Daily' ? Math.ceil(duration / 24) * spot.price : spot.price : 0;
  const schedule = spot.availabilities.filter(a => a.dayOfWeek === days[new Date(`${date}T12:00`).getDay()][0] || a.specificDate === date);
  async function submit(event) {
    event.preventDefault();
    if (duration <= 0) { setError('A saída precisa ser depois da entrada.'); return; }
    try { setWorking(true); setError(''); await onReserve(spot, new Date(`${date}T${start}`).toISOString(), new Date(`${endDate}T${end}`).toISOString()); }
    catch (e) { setError(e.message); } finally { setWorking(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal"><div className="modal-header"><span className="modal-tag"><ParkingSquare size={15} /> DETALHES DA VAGA</span><button onClick={onClose} aria-label="Fechar"><X size={21} /></button></div><div className="modal-body"><h2>{spot.title}</h2><p className="modal-address"><MapPin size={16} />{spot.address}</p><p className="modal-description">{spot.description || 'Vaga particular disponível para reserva.'}</p><div className="modal-facts"><div><span><UserRound size={16} /> Anfitrião</span><strong>{spot.ownerName}</strong></div><div><span><Wallet size={16} /> Valor</span><strong>{money(spot.price)} {pricingText[spot.pricingType]}</strong></div></div><form onSubmit={submit}><h3>Escolha seu horário</h3><div className="form-grid two"><label>Data de entrada<input required type="date" min={today()} value={date} onChange={e => { setDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }} /></label><label>Hora de entrada<input required type="time" value={start} onChange={e => setStart(e.target.value)} /></label><label>Data de saída<input required type="date" min={date} value={endDate} onChange={e => setEndDate(e.target.value)} /></label><label>Hora de saída<input required type="time" value={end} onChange={e => setEnd(e.target.value)} /></label></div><div className="schedule-note"><Clock3 size={16} /><span>{schedule.length ? `Na entrada: ${schedule.map(a => `${a.startTime.slice(0,5)}–${a.endTime.slice(0,5)}`).join(', ')}. Todos os dias da reserva precisam estar disponíveis.` : 'Sem disponibilidade cadastrada para a data de entrada.'}</span></div>{error && <div className="alert error-alert">{error}</div>}<div className="modal-total"><span>Valor estimado<small>{spot.pricingType === 'Hourly' ? 'Cobrança por hora iniciada' : spot.pricingType === 'Daily' ? 'Cobrança por diária iniciada' : 'Preço fixo por reserva'}</small></span><strong>{money(estimated)}</strong></div><button className="btn btn-primary full" disabled={working || duration <= 0 || !schedule.length}>{working ? 'Confirmando...' : 'Confirmar reserva'} <ArrowRight size={17} /></button></form></div></div></div>;
}

function OwnerDashboard({ spots, bookings, onNew, onEdit, onDelete }) {
  const activeBookings = bookings.filter(b => b.status === 'Confirmed' && new Date(b.endsAtUtc) > new Date());
  return <div className="page-content"><div className="page-heading"><div><div className="eyebrow">SEU ESPAÇO NO LOOP</div><h1>Minhas vagas<span>.</span></h1><p>Cadastre seus espaços e acompanhe as reservas.</p></div><button className="btn btn-primary" onClick={onNew}><Plus size={18} /> Anunciar vaga</button></div><div className="stat-grid"><Stat icon={ParkingSquare} label="Vagas ativas" value={spots.length} /><Stat icon={CalendarDays} label="Reservas futuras" value={activeBookings.length} /><Stat icon={Wallet} label="Valor reservado" value={money(activeBookings.reduce((sum, b) => sum + Number(b.total), 0))} /></div><div className="section-heading"><div><div className="section-kicker">SEUS ANÚNCIOS</div><h2>Espaços cadastrados</h2></div></div>{spots.length ? <div className="owner-grid">{spots.map(spot => <article className="owner-card" key={spot.id}><div className="owner-card-top"><span className="spot-icon"><ParkingSquare size={24} /></span><span className="status-badge"><span /> Ativa</span></div><h3>{spot.title}</h3><p><MapPin size={15} />{spot.address}</p><div className="owner-price">{money(spot.price)} <span>{pricingText[spot.pricingType]}</span></div><div className="owner-actions"><button className="btn btn-outline" onClick={() => onEdit(spot)}>Editar vaga</button><button className="icon-button" title="Desativar vaga" onClick={() => onDelete(spot.id)}><Trash2 size={17} /></button></div></article>)}</div> : <div className="empty-state large"><span><ParkingSquare size={30} /></span><h3>Seu primeiro anúncio começa aqui</h3><p>Cadastre uma vaga e defina quando ela fica disponível.</p><button className="btn btn-primary" onClick={onNew}><Plus size={18} /> Anunciar vaga</button></div>}</div>;
}

function SpotModal({ initial, ownerId, onClose, onSave }) {
  const [form, setForm] = useState(initial ? { title: initial.title, address: initial.address, description: initial.description, latitude: Number(initial.latitude), longitude: Number(initial.longitude), pricingType: initial.pricingType, price: initial.price } : { title: '', address: '', description: '', latitude: null, longitude: null, pricingType: 'Hourly', price: '' });
  const [schedule, setSchedule] = useState(initial?.availabilities?.length ? { mode: initial.availabilities[0].specificDate ? 'date' : 'weekly', days: initial.availabilities.filter(a => a.dayOfWeek).map(a => a.dayOfWeek), date: initial.availabilities[0].specificDate || today(), start: initial.availabilities[0].startTime.slice(0,5), end: initial.availabilities[0].endTime.slice(0,5) } : initialSchedule);
  const [mapStatus, setMapStatus] = useState('loading');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const mapNode = useRef(null);
  const map = useRef(null);
  const pin = useRef(null);

  useEffect(() => {
    let active = true;
    loadGoogleMaps().then(maps => {
      if (!active || !mapNode.current) return;
      map.current = new maps.Map(mapNode.current, { center: form.latitude ? { lat: form.latitude, lng: form.longitude } : center, zoom: 14, disableDefaultUI: true, zoomControl: true });
      if (form.latitude) pin.current = new maps.Marker({ map: map.current, position: { lat: form.latitude, lng: form.longitude } });
      map.current.addListener('click', event => {
        const position = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        setForm(previous => ({ ...previous, latitude: position.lat, longitude: position.lng }));
        pin.current?.setMap(null);
        pin.current = new maps.Marker({ map: map.current, position });
      });
      setMapStatus('ready');
    }).catch(e => { if (active) { setMapStatus('error'); setError(e.message); } });
    return () => { active = false; pin.current?.setMap(null); map.current = null; };
  }, []);

  async function findAddress() {
    try {
      const maps = await loadGoogleMaps();
      const result = await new maps.Geocoder().geocode({ address: form.address, region: 'BR' });
      if (!result.results?.length) throw new Error('Endereço não encontrado. Tente incluir cidade e estado.');
      const loc = result.results[0].geometry.location;
      const position = { lat: loc.lat(), lng: loc.lng() };
      setForm(prev => ({ ...prev, latitude: position.lat, longitude: position.lng }));
      map.current?.panTo(position);
      pin.current?.setMap(null);
      pin.current = new maps.Marker({ map: map.current, position });
      setError('');
    } catch (e) { setError(e.message); }
  }

  function toggleDay(day) { setSchedule(prev => ({ ...prev, days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day] })); }
  async function submit(event) {
    event.preventDefault();
    if (form.latitude == null || form.longitude == null) { setError('Busque o endereço ou marque a vaga no mapa.'); return; }
    if (schedule.end <= schedule.start) { setError('O horário de término deve ser depois do início.'); return; }
    if (schedule.mode === 'weekly' && !schedule.days.length) { setError('Escolha ao menos um dia da semana.'); return; }
    const availabilities = schedule.mode === 'weekly' ? schedule.days.map(dayOfWeek => ({ dayOfWeek, specificDate: null, startTime: `${schedule.start}:00`, endTime: `${schedule.end}:00` })) : [{ specificDate: schedule.date, dayOfWeek: null, startTime: `${schedule.start}:00`, endTime: `${schedule.end}:00` }];
    try { setWorking(true); setError(''); await onSave({ ...form, ownerId, price: Number(form.price), availabilities }, initial?.id); }
    catch (e) { setError(e.message); } finally { setWorking(false); }
  }

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal spot-modal"><div className="modal-header"><span className="modal-tag"><ParkingSquare size={15} /> {initial ? 'EDITAR VAGA' : 'NOVO ANÚNCIO'}</span><button onClick={onClose} aria-label="Fechar"><X size={21} /></button></div><div className="modal-body"><h2>{initial ? 'Atualize sua vaga' : 'Anuncie sua vaga'}</h2><p className="modal-description">Conte aos motoristas onde e quando seu espaço está disponível.</p><form onSubmit={submit}><label>Título do anúncio<input required maxLength="100" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Vaga coberta perto da universidade" /></label><label>Endereço completo<div className="input-action"><input required maxLength="200" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Rua, número, bairro, cidade" /><button type="button" onClick={findAddress}>Localizar</button></div></label><label>Descrição<textarea rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Acesso, cobertura, observações..." /></label><div className="location-label"><MapPin size={16} /> Localização exata <small>Busque o endereço ou clique no mapa</small></div><div className="form-map-wrap"><div ref={mapNode} className="form-map" />{mapStatus !== 'ready' && <div className="form-map-fallback">{mapStatus === 'loading' ? 'Carregando mapa...' : 'Configure a chave do Google Maps para marcar a vaga.'}</div>}</div><div className={`location-confirm ${form.latitude ? 'confirmed' : ''}`}>{form.latitude ? <><Check size={15} /> Localização marcada: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</> : 'Nenhuma localização marcada'}</div><div className="form-grid two"><label>Forma de cobrança<select value={form.pricingType} onChange={e => setForm({ ...form, pricingType: e.target.value })}><option value="Hourly">Por hora</option><option value="Daily">Por diária</option><option value="Fixed">Valor fixo</option></select></label><label>Valor (R$)<input required type="number" min="0.01" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0,00" /></label></div><div className="schedule-header"><Clock3 size={17} /><strong>Quando a vaga fica disponível?</strong></div><div className="segmented"><button type="button" className={schedule.mode === 'weekly' ? 'selected' : ''} onClick={() => setSchedule({ ...schedule, mode: 'weekly' })}>Toda semana</button><button type="button" className={schedule.mode === 'date' ? 'selected' : ''} onClick={() => setSchedule({ ...schedule, mode: 'date' })}>Data específica</button></div>{schedule.mode === 'weekly' ? <div className="day-picker">{days.map(([key, label]) => <button type="button" key={key} className={schedule.days.includes(key) ? 'selected' : ''} onClick={() => toggleDay(key)}>{label}</button>)}</div> : <label>Data disponível<input required type="date" min={today()} value={schedule.date} onChange={e => setSchedule({ ...schedule, date: e.target.value })} /></label>}<div className="form-grid two"><label>Das<input required type="time" value={schedule.start} onChange={e => setSchedule({ ...schedule, start: e.target.value })} /></label><label>Até<input required type="time" value={schedule.end} onChange={e => setSchedule({ ...schedule, end: e.target.value })} /></label></div>{error && <div className="alert error-alert">{error}</div>}<button className="btn btn-primary full" disabled={working}>{working ? 'Salvando...' : initial ? 'Salvar alterações' : 'Publicar vaga'} <ArrowRight size={17} /></button></form></div></div></div>;
}

function BookingsView({ bookings, role, onCancel }) {
  return <div className="page-content"><div className="page-heading"><div><div className="eyebrow">AGENDA LOOP</div><h1>{role === 'Driver' ? 'Minhas reservas' : 'Reservas recebidas'}<span>.</span></h1><p>Acompanhe os horários e os detalhes de cada reserva.</p></div></div><div className="section-heading"><div><div className="section-kicker">HISTÓRICO</div><h2>{bookings.length} {bookings.length === 1 ? 'reserva' : 'reservas'}</h2></div></div>{bookings.length ? <div className="booking-list">{bookings.map(booking => <article className="booking-card" key={booking.id}><div className="booking-date"><strong>{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(booking.startsAtUtc))}</strong><span>{new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(booking.startsAtUtc)).replace('.', '')}</span></div><div className="booking-main"><div className="booking-title-row"><h3>{booking.spotTitle}</h3><span className={`booking-status ${booking.status === 'Cancelled' ? 'cancelled' : ''}`}>{booking.status === 'Cancelled' ? 'Cancelada' : 'Confirmada'}</span></div><p><Clock3 size={15} /> {dateTime(booking.startsAtUtc)} até {dateTime(booking.endsAtUtc)}</p>{role !== 'Driver' && <p><UserRound size={15} /> Motorista: {booking.driverName}</p>}</div><div className="booking-side"><strong>{money(booking.total)}</strong>{role === 'Driver' && booking.status === 'Confirmed' && new Date(booking.startsAtUtc) > new Date() && <button onClick={() => onCancel(booking.id)}>Cancelar reserva</button>}</div></article>)}</div> : <div className="empty-state large"><span><CalendarDays size={30} /></span><h3>Nenhuma reserva por enquanto</h3><p>Quando houver uma reserva, os detalhes aparecerão aqui.</p></div>}</div>;
}

function AdminDashboard({ users, spots, bookings }) {
  const [tab, setTab] = useState('spots');
  return <div className="page-content"><div className="page-heading"><div><div className="eyebrow">PAINEL ADMINISTRATIVO</div><h1>Visão geral<span>.</span></h1><p>Um panorama simples da atividade da plataforma.</p></div><span className="heading-stamp"><ShieldCheck size={17} /> Acesso administrativo</span></div><div className="stat-grid"><Stat icon={UserRound} label="Usuários" value={users.length} /><Stat icon={ParkingSquare} label="Vagas ativas" value={spots.filter(s => s.isActive).length} /><Stat icon={CalendarDays} label="Reservas" value={bookings.length} /></div><div className="admin-table"><div className="table-tabs">{[['spots', 'Vagas'], ['users', 'Usuários'], ['bookings', 'Reservas']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div><div className="table-scroll"><table><thead><tr>{(tab === 'spots' ? ['Vaga', 'Proprietário', 'Preço', 'Status'] : tab === 'users' ? ['Nome', 'E-mail', 'Perfil'] : ['Vaga', 'Motorista', 'Entrada', 'Valor', 'Status']).map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{tab === 'spots' ? spots.map(s => <tr key={s.id}><td><strong>{s.title}</strong><small>{s.address}</small></td><td>{s.ownerName}</td><td>{money(s.price)} {pricingText[s.pricingType]}</td><td><span className={`table-status ${s.isActive ? '' : 'muted'}`}>{s.isActive ? 'Ativa' : 'Desativada'}</span></td></tr>) : tab === 'users' ? users.map(u => <tr key={u.id}><td><strong>{u.name}</strong></td><td>{u.email}</td><td>{roleText[u.role]}</td></tr>) : bookings.map(b => <tr key={b.id}><td><strong>{b.spotTitle}</strong></td><td>{b.driverName}</td><td>{dateTime(b.startsAtUtc)}</td><td>{money(b.total)}</td><td><span className={`table-status ${b.status === 'Cancelled' ? 'muted' : ''}`}>{b.status === 'Cancelled' ? 'Cancelada' : 'Confirmada'}</span></td></tr>)}</tbody></table>{!(tab === 'spots' ? spots : tab === 'users' ? users : bookings).length && <div className="table-empty">Nenhum registro encontrado.</div>}</div></div></div>;
}

function Stat({ icon: Icon, label, value }) { return <div className="stat-card"><span><Icon size={22} /></span><small>{label}</small><strong>{value}</strong></div>; }

createRoot(document.getElementById('root')).render(<App />);
