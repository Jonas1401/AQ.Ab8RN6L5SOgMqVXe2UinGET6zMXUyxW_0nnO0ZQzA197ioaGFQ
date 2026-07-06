import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Check, 
  Cloud, 
  CloudLightning, 
  X, 
  Camera,
  FileText,
  Share2,
  FileDown,
  CheckSquare,
  Square,
  Info,
  Calendar,
  AlertCircle,
  Clock,
  Notebook,
  CheckCircle2,
  ListTodo,
  Palette
} from 'lucide-react';
import { 
  db,
  collection, 
  doc, 
  addDoc, 
  setDoc,
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  syncTicketToSupabase,
  deleteTicketFromSupabase,
  syncEventToSupabase,
  deleteEventFromSupabase,
  syncNoteToSupabase,
  deleteNoteFromSupabase,
  syncChecklistToSupabase,
  deleteChecklistFromSupabase
} from '../lib/supabase';
import { 
  TravelTicket, 
  OrganizerEvent, 
  OrganizerNote, 
  OrganizerChecklist,
  OrganizerChecklistItem 
} from '../types';
import { compressImage } from '../lib/imageCompression';
import { jsPDF } from 'jspdf';

interface OrganizerViewProps {
  userId: string;
  userName: string;
  userAvatar: string;
  onBack: () => void;
}

export default function OrganizerView({ userId, userName, userAvatar, onBack }: OrganizerViewProps) {
  // Navigation & Sync State
  const [activeTab, setActiveTab] = useState<'tickets' | 'notes'>('tickets');
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<'synced' | 'saving' | 'error'>('synced');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Supabase Real-time Collections States
  const [tickets, setTickets] = useState<TravelTicket[]>([]);
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [notes, setNotes] = useState<OrganizerNote[]>([]);
  const [checklists, setChecklists] = useState<OrganizerChecklist[]>([]);

  // Selection states for Tickets Tab (for batch actions)
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

  // Modal display states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [showAddTicketModal, setShowAddTicketModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false);

  // Active view states
  const [viewingTicket, setViewingTicket] = useState<TravelTicket | null>(null);
  const [viewingNote, setViewingNote] = useState<OrganizerNote | null>(null);

  // Form States - Ticket
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDate, setTicketDate] = useState(new Date().toISOString().split('T')[0]);
  const [ticketDesc, setTicketDesc] = useState('');

  // Form States - Event
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('12:00');
  const [eventDesc, setEventDesc] = useState('');

  // Form States - Note
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState('#f97316'); // hex color code

  // Form States - Checklist
  const [checklistTitle, setChecklistTitle] = useState('');
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [tempChecklistItems, setTempChecklistItems] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Sync TICKETS in real-time
  useEffect(() => {
    setLoading(true);
    const ticketsRef = collection(db, 'users', userId, 'tickets');
    const ticketsQuery = query(ticketsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(ticketsQuery, (snapshot) => {
      const list: TravelTicket[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TravelTicket);
      });
      setTickets(list);
      setLoading(false);
      setSyncState('synced');
    }, (err) => {
      console.error('Error fetching tickets:', err);
      setSyncState('error');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // 2. Sync EVENTS in real-time
  useEffect(() => {
    const eventsRef = collection(db, 'users', userId, 'events');
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'));

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const list: OrganizerEvent[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrganizerEvent);
      });
      setEvents(list);
      setSyncState('synced');
    }, (err) => {
      console.error('Error fetching events:', err);
      setSyncState('error');
    });

    return () => unsubscribe();
  }, [userId]);

  // 3. Sync NOTES in real-time
  useEffect(() => {
    const notesRef = collection(db, 'users', userId, 'notes');
    const notesQuery = query(notesRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const list: OrganizerNote[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrganizerNote);
      });
      setNotes(list);
      setSyncState('synced');
    }, (err) => {
      console.error('Error fetching notes:', err);
      setSyncState('error');
    });

    return () => unsubscribe();
  }, [userId]);

  // 4. Sync CHECKLISTS in real-time
  useEffect(() => {
    const checklistsRef = collection(db, 'users', userId, 'checklists');
    const checklistsQuery = query(checklistsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(checklistsQuery, (snapshot) => {
      const list: OrganizerChecklist[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrganizerChecklist);
      });
      setChecklists(list);
      setSyncState('synced');
    }, (err) => {
      console.error('Error fetching checklists:', err);
      setSyncState('error');
    });

    return () => unsubscribe();
  }, [userId]);

  // ==========================================
  // TICKETS ACTIONS & HANDLERS
  // ==========================================

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgressText('Otimizando imagem para alta resolução...');
    
    try {
      const highResBase64 = await compressImage(file, 1600, 1600, 0.88);
      setPreviewImage(highResBase64);
      setTicketTitle(`Ticket - ${new Date().toLocaleDateString('pt-BR')}`);
      setShowAddTicketModal(true);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Erro ao processar imagem.');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewImage || !ticketTitle.trim() || !ticketDate) return;

    setSyncState('saving');
    setIsUploading(true);
    setUploadProgressText('Salvando ticket na nuvem de forma segura...');

    const newTicket = {
      userId,
      title: ticketTitle.trim(),
      date: ticketDate,
      imageUrl: previewImage,
      description: ticketDesc.trim(),
      createdAt: Date.now()
    };

    try {
      const ticketsRef = collection(db, 'users', userId, 'tickets');
      const docRef = await addDoc(ticketsRef, newTicket);
      
      try {
        await syncTicketToSupabase({
          id: docRef.id,
          ...newTicket
        });
      } catch (sbErr) {
        console.warn('Supabase sync failed (ignored):', sbErr);
      }
      
      setSyncState('synced');
      showToast('Ticket de Viagem armazenado com sucesso!');
      setShowAddTicketModal(false);
      setPreviewImage(null);
      setTicketTitle('');
      setTicketDesc('');
    } catch (err) {
      console.error('Error storing ticket:', err);
      setSyncState('error');
      showToast('Erro ao salvar. Verifique sua conexão.');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  };

  const handleDeleteTicket = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir permanentemente este ticket?')) {
      setSyncState('saving');
      try {
        const docRef = doc(db, 'users', userId, 'tickets', id);
        await deleteDoc(docRef);
        
        try {
          await deleteTicketFromSupabase(id);
        } catch (sbErr) {
          console.warn('Supabase delete failed (ignored):', sbErr);
        }
        
        setSyncState('synced');
        showToast('Ticket excluído com sucesso.');
        setSelectedTicketIds(prev => prev.filter(tid => tid !== id));
        if (viewingTicket?.id === id) setViewingTicket(null);
      } catch (err) {
        console.error(err);
        setSyncState('error');
        showToast('Erro ao excluir ticket.');
      }
    }
  };

  const toggleSelectTicket = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTicketIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.length === tickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(tickets.map(t => t.id));
    }
  };

  const handleExportPDF = () => {
    if (selectedTicketIds.length === 0) return;
    showToast('Gerando PDF com os tickets selecionados...');
    
    try {
      const selectedTickets = tickets.filter(t => selectedTicketIds.includes(t.id));
      const docPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      selectedTickets.forEach((ticket, idx) => {
        if (idx > 0) docPdf.addPage();

        docPdf.setFillColor(249, 115, 22); // Orange #f97316
        docPdf.rect(0, 0, 210, 10, 'F');

        docPdf.setTextColor(3, 9, 20); // Dark text
        docPdf.setFont('helvetica', 'bold');
        docPdf.setFontSize(16);
        docPdf.text('TICKET DE VIAGEM - COMPROVANTE', 15, 25);

        docPdf.setFont('helvetica', 'normal');
        docPdf.setFontSize(10);
        docPdf.setTextColor(100, 116, 139);
        
        docPdf.text(`Motorista: ${userName || 'Não Identificado'}`, 15, 33);
        docPdf.text(`Data do Ticket: ${new Date(ticket.date + 'T12:00:00').toLocaleDateString('pt-BR')}`, 15, 39);
        docPdf.text(`Título: ${ticket.title}`, 15, 45);
        if (ticket.description) {
          docPdf.text(`Observações: ${ticket.description}`, 15, 51);
        }

        docPdf.setDrawColor(226, 232, 240);
        docPdf.rect(14, 58, 182, 222);

        try {
          docPdf.addImage(ticket.imageUrl, 'JPEG', 15, 59, 180, 220);
        } catch (imgErr) {
          console.error('Failed to embed image in PDF page', imgErr);
          docPdf.setTextColor(239, 68, 68);
          docPdf.text('Não foi possível renderizar a imagem do ticket neste PDF.', 20, 100);
        }

        docPdf.setFontSize(8);
        docPdf.setTextColor(148, 163, 184);
        docPdf.text(`Página ${idx + 1} de ${selectedTickets.length}`, 105, 290, { align: 'center' });
      });

      docPdf.save(`PortoConecta-Tickets-${Date.now()}.pdf`);
      showToast('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Erro ao exportar PDF.');
    }
  };

  const handleExportSinglePDF = (ticket: TravelTicket) => {
    showToast('Gerando PDF do ticket...');
    try {
      const docPdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      docPdf.setFillColor(249, 115, 22); // Orange #f97316
      docPdf.rect(0, 0, 210, 10, 'F');

      docPdf.setTextColor(3, 9, 20); // Dark text
      docPdf.setFont('helvetica', 'bold');
      docPdf.setFontSize(16);
      docPdf.text('TICKET DE VIAGEM - COMPROVANTE', 15, 25);

      docPdf.setFont('helvetica', 'normal');
      docPdf.setFontSize(10);
      docPdf.setTextColor(100, 116, 139);
      
      docPdf.text(`Motorista: ${userName || 'Não Identificado'}`, 15, 33);
      docPdf.text(`Data do Ticket: ${new Date(ticket.date + 'T12:00:00').toLocaleDateString('pt-BR')}`, 15, 39);
      docPdf.text(`Título: ${ticket.title}`, 15, 45);
      if (ticket.description) {
        docPdf.text(`Observações: ${ticket.description}`, 15, 51);
      }

      docPdf.setDrawColor(226, 232, 240);
      docPdf.rect(14, 58, 182, 222);

      try {
        docPdf.addImage(ticket.imageUrl, 'JPEG', 15, 59, 180, 220);
      } catch (imgErr) {
        console.error('Failed to embed image in PDF page', imgErr);
        docPdf.setTextColor(239, 68, 68);
        docPdf.text('Não foi possível renderizar a imagem do ticket neste PDF.', 20, 100);
      }

      docPdf.setFontSize(8);
      docPdf.setTextColor(148, 163, 184);
      docPdf.text('Página 1 de 1', 105, 290, { align: 'center' });

      docPdf.save(`PortoConecta-Ticket-${ticket.title.replace(/\s+/g, '_')}-${Date.now()}.pdf`);
      showToast('PDF exportado com sucesso!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showToast('Erro ao exportar PDF.');
    }
  };

  const handleShareWhatsApp = () => {
    if (selectedTicketIds.length === 0) return;
    const selectedTickets = tickets.filter(t => selectedTicketIds.includes(t.id));
    
    let reportText = `🚚 *PORTO CONECTA - COMPROVANTE DE TICKETS* 🚚\n\n`;
    reportText += `👤 *Motorista:* ${userName}\n`;
    reportText += `📅 *Relatório:* ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n`;
    reportText += `-------------------------------------------\n\n`;

    selectedTickets.forEach((ticket, idx) => {
      reportText += `*${idx + 1}. ${ticket.title.toUpperCase()}*\n`;
      reportText += `📅 Data: ${new Date(ticket.date + 'T12:00:00').toLocaleDateString('pt-BR')}\n`;
      if (ticket.description) reportText += `📝 Obs: ${ticket.description}\n`;
      reportText += `\n`;
    });

    reportText += `📌 _Tickets arquivados com sucesso no Porto Conecta._`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(reportText)}`;
    window.open(whatsappUrl, '_blank');
    showToast('Compartilhando relatório via WhatsApp!');
  };


  // ==========================================
  // EVENTS ACTIONS & HANDLERS
  // ==========================================

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;

    setSyncState('saving');
    const newEvent = {
      userId,
      title: eventTitle.trim(),
      date: eventDate,
      time: eventTime,
      description: eventDesc.trim(),
      createdAt: Date.now()
    };

    try {
      const eventsRef = collection(db, 'users', userId, 'events');
      const docRef = await addDoc(eventsRef, newEvent);
      
      try {
        await syncEventToSupabase({
          id: docRef.id,
          ...newEvent
        });
      } catch (sbErr) {
        console.warn('Supabase sync failed (ignored):', sbErr);
      }
      
      setSyncState('synced');
      showToast('Compromisso agendado com sucesso!');
      setShowAddEventModal(false);
      setEventTitle('');
      setEventDesc('');
      setEventTime('12:00');
    } catch (err) {
      console.error('Error storing event:', err);
      setSyncState('error');
      showToast('Erro ao agendar compromisso.');
    }
  };

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Excluir este compromisso permanentemente?')) {
      setSyncState('saving');
      try {
        await deleteDoc(doc(db, 'users', userId, 'events', id));
        
        try {
          await deleteEventFromSupabase(id);
        } catch (sbErr) {
          console.warn('Supabase delete failed (ignored):', sbErr);
        }
        
        setSyncState('synced');
        showToast('Compromisso excluído.');
      } catch (err) {
        console.error(err);
        setSyncState('error');
        showToast('Erro ao excluir compromisso.');
      }
    }
  };


  // ==========================================
  // NOTES ACTIONS & HANDLERS
  // ==========================================

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;

    setSyncState('saving');
    const newNote = {
      userId,
      title: noteTitle.trim(),
      content: noteContent.trim(),
      color: noteColor,
      createdAt: Date.now()
    };

    try {
      const notesRef = collection(db, 'users', userId, 'notes');
      const docRef = await addDoc(notesRef, newNote);
      
      try {
        await syncNoteToSupabase({
          id: docRef.id,
          ...newNote
        });
      } catch (sbErr) {
        console.warn('Supabase sync failed (ignored):', sbErr);
      }
      
      setSyncState('synced');
      showToast('Nota salva com sucesso!');
      setShowAddNoteModal(false);
      setNoteTitle('');
      setNoteContent('');
      setNoteColor('#f97316');
    } catch (err) {
      console.error('Error storing note:', err);
      setSyncState('error');
      showToast('Erro ao salvar nota.');
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Excluir esta nota permanentemente?')) {
      setSyncState('saving');
      try {
        await deleteDoc(doc(db, 'users', userId, 'notes', id));
        
        try {
          await deleteNoteFromSupabase(id);
        } catch (sbErr) {
          console.warn('Supabase delete failed (ignored):', sbErr);
        }
        
        setSyncState('synced');
        showToast('Nota excluída.');
        if (viewingNote?.id === id) setViewingNote(null);
      } catch (err) {
        console.error(err);
        setSyncState('error');
        showToast('Erro ao excluir nota.');
      }
    }
  };


  // ==========================================
  // CHECKLISTS ACTIONS & HANDLERS
  // ==========================================

  const handleAddTempChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChecklistItemText.trim()) return;
    setTempChecklistItems(prev => [...prev, newChecklistItemText.trim()]);
    setNewChecklistItemText('');
  };

  const handleRemoveTempChecklistItem = (idx: number) => {
    setTempChecklistItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checklistTitle.trim() || tempChecklistItems.length === 0) return;

    setSyncState('saving');
    const newChecklist = {
      userId,
      title: checklistTitle.trim(),
      items: tempChecklistItems.map((itemText, idx) => ({
        id: `item-${idx}-${Date.now()}`,
        text: itemText,
        completed: false
      })),
      createdAt: Date.now()
    };

    try {
      const checklistsRef = collection(db, 'users', userId, 'checklists');
      const docRef = await addDoc(checklistsRef, newChecklist);
      
      try {
        await syncChecklistToSupabase({
          id: docRef.id,
          ...newChecklist
        });
      } catch (sbErr) {
        console.warn('Supabase sync failed (ignored):', sbErr);
      }
      
      setSyncState('synced');
      showToast('Checklist criado com sucesso!');
      setShowAddChecklistModal(false);
      setChecklistTitle('');
      setTempChecklistItems([]);
    } catch (err) {
      console.error('Error storing checklist:', err);
      setSyncState('error');
      showToast('Erro ao salvar checklist.');
    }
  };

  const handleToggleChecklistItem = async (checklistId: string, itemId: string) => {
    const checklist = checklists.find(c => c.id === checklistId);
    if (!checklist) return;
    const updatedItems = checklist.items.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setSyncState('saving');
    try {
      const docRef = doc(db, 'users', userId, 'checklists', checklistId);
      await setDoc(docRef, { items: updatedItems }, { merge: true });
      
      try {
        await syncChecklistToSupabase({
          id: checklistId,
          userId,
          title: checklist.title,
          items: updatedItems,
          createdAt: checklist.createdAt
        });
      } catch (sbErr) {
        console.warn('Supabase sync failed (ignored):', sbErr);
      }
      
      setSyncState('synced');
    } catch (err) {
      console.error('Error toggling checklist item:', err);
      setSyncState('error');
      showToast('Erro ao atualizar tarefa.');
    }
  };

  const handleDeleteChecklist = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Excluir este checklist permanentemente?')) {
      setSyncState('saving');
      try {
        await deleteDoc(doc(db, 'users', userId, 'checklists', id));
        
        try {
          await deleteChecklistFromSupabase(id);
        } catch (sbErr) {
          console.warn('Supabase delete failed (ignored):', sbErr);
        }
        
        setSyncState('synced');
        showToast('Checklist excluído.');
      } catch (err) {
        console.error(err);
        setSyncState('error');
        showToast('Erro ao excluir checklist.');
      }
    }
  };


  return (
    <div className="min-h-screen bg-[#030914] flex flex-col justify-between font-sans text-white relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-x-0 top-0 h-[150px] bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] rounded-full bg-orange-600/5 blur-[100px] pointer-events-none" />

      {/* Header Container */}
      <div className="w-full max-w-md mx-auto px-4 pt-4 shrink-0 z-10">
        <header className="flex items-center justify-between py-2 mb-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-sm font-extrabold tracking-wider uppercase text-white leading-none">
                {activeTab === 'tickets' && 'Meus Tickets'}
                {activeTab === 'notes' && 'Minhas Notas'}
              </h1>
              <span className="text-[10px] text-gray-400">
                {activeTab === 'tickets' && 'Comprovantes em Alta Resolução'}
                {activeTab === 'notes' && 'Anotações e Lembretes Rápidos'}
              </span>
            </div>
          </div>

          {/* Sync status indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0B1E36] border border-orange-500/25 shadow-md shadow-orange-500/5 select-none text-[9.5px] font-bold uppercase tracking-wider text-orange-400">
            {syncState === 'synced' && (
              <>
                <Cloud size={12} className="text-green-400 animate-pulse" />
                <span className="text-green-400">Supabase Conectado</span>
              </>
            )}
            {syncState === 'saving' && (
              <>
                <div className="w-2.5 h-2.5 rounded-full border border-orange-500 border-t-transparent animate-spin shrink-0" />
                <span>Salvando...</span>
              </>
            )}
            {syncState === 'error' && (
              <>
                <CloudLightning size={12} className="text-rose-400" />
                <span className="text-rose-400">Modo Offline</span>
              </>
            )}
          </div>
        </header>

        {/* Quick Instructions Banner */}
        <div className="bg-orange-500/5 border border-orange-500/15 rounded-2xl p-3 flex items-start gap-2.5 mb-4 select-none">
          <Info size={16} className="text-orange-400 shrink-0 mt-0.5" />
          <p className="text-[10px] leading-relaxed text-gray-300">
            {activeTab === 'tickets' && (
              <>Tire fotos legíveis dos seus <strong className="text-white">Tickets de Viagem</strong>. Seus comprovantes são compactados e guardados na nuvem de forma permanente.</>
            )}
            {activeTab === 'notes' && (
              <>Guarde anotações rápidas sobre <strong className="text-white">placas, rotas, contatos</strong> ou pedágios. Organize em cartões coloridos de fácil acesso rápido.</>
            )}
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/5 mb-4 select-none">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex-1 pb-2.5 text-[10px] font-extrabold uppercase tracking-widest text-center border-b-2 transition cursor-pointer ${
              activeTab === 'tickets' 
                ? 'border-orange-500 text-orange-400 font-black' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            🎫 Tickets
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 pb-2.5 text-[10px] font-extrabold uppercase tracking-widest text-center border-b-2 transition cursor-pointer ${
              activeTab === 'notes' 
                ? 'border-orange-500 text-orange-400 font-black' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            📝 Notas
          </button>
        </div>

        {/* Selection/Action Header (Tickets Tab Only) */}
        {activeTab === 'tickets' && tickets.length > 0 && (
          <div className="flex items-center justify-between px-1 mb-2 select-none">
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition"
            >
              {selectedTicketIds.length === tickets.length ? (
                <>
                  <CheckSquare size={14} className="text-orange-400" />
                  <span>Desmarcar Todos</span>
                </>
              ) : (
                <>
                  <Square size={14} className="text-gray-500" />
                  <span>Selecionar Todos ({selectedTicketIds.length})</span>
                </>
              )}
            </button>

            <span className="text-[9.5px] font-extrabold uppercase text-gray-500">
              {tickets.length} {tickets.length === 1 ? 'Ticket' : 'Tickets'} Salvos
            </span>
          </div>
        )}
      </div>

      {/* Main content body */}
      <div className="flex-1 overflow-y-auto w-full max-w-md mx-auto px-4 py-1 z-10 scrollbar-none">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 gap-3">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Buscando do Supabase...</p>
          </div>
        ) : (
          <>
            {/* ==================== TICKETS VIEW ==================== */}
            {activeTab === 'tickets' && (
              tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/5 rounded-[24px] bg-white/[0.01] px-6 gap-4 select-none">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-500/10 to-amber-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
                    <Camera size={26} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-200">Nenhum Ticket Armazenado</p>
                    <p className="text-[10px] text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                      Tire uma foto de alta resolução ou envie um arquivo para manter seus tickets salvos na sua conta de forma permanente.
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl text-[10.5px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/15 hover:shadow-orange-500/25 transition-all cursor-pointer active:scale-95"
                  >
                    Capturar Ticket Agora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-32">
                  {tickets.map(ticket => {
                    const isSelected = selectedTicketIds.includes(ticket.id);
                    
                    return (
                      <div
                        key={ticket.id}
                        onClick={() => setViewingTicket(ticket)}
                        className={`relative rounded-2xl bg-gradient-to-b from-[#0A1C30]/15 to-[#030914]/15 backdrop-blur-xl border overflow-hidden flex flex-col justify-between transition-all duration-150 cursor-pointer shadow-md select-none group ${
                          isSelected 
                            ? 'border-orange-500 shadow-lg shadow-orange-500/10' 
                            : 'border-white/5 hover:border-white/10'
                        }`}
                      >
                        {/* Image Preview */}
                        <div className="relative w-full aspect-[4/5] bg-black/40 overflow-hidden border-b border-white/5 flex items-center justify-center">
                          <img 
                            src={ticket.imageUrl} 
                            alt={ticket.title} 
                            className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                            referrerPolicy="no-referrer"
                          />
                          
                          <button
                            onClick={(e) => toggleSelectTicket(ticket.id, e)}
                            className="absolute top-2.5 left-2.5 w-6 h-6 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer shadow"
                            style={{ 
                              backgroundColor: isSelected ? '#f97316' : 'rgba(0,0,0,0.5)',
                              borderColor: isSelected ? '#f97316' : 'rgba(255,255,255,0.2)' 
                            }}
                          >
                            {isSelected ? (
                              <Check size={14} className="text-white" strokeWidth={3} />
                            ) : (
                              <div className="w-2.5 h-2.5 rounded-sm border border-transparent" />
                            )}
                          </button>

                        </div>

                        {/* Info Row */}
                        <div className="p-3 flex flex-col justify-between gap-1.5">
                          <div className="min-w-0">
                            <p className="text-[10.5px] text-gray-200 font-medium leading-relaxed break-words line-clamp-3">
                              {ticket.description || "Sem notas salvas."}
                            </p>
                          </div>

                          <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-2">
                            <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">
                              {new Date(ticket.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={(e) => handleDeleteTicket(ticket.id, e)}
                              className="p-1 rounded bg-white/5 hover:bg-rose-500/15 text-gray-500 hover:text-rose-400 transition cursor-pointer"
                              title="Deletar Ticket"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ==================== EVENTS (AGENDA) VIEW ==================== */}
            {activeTab === 'events' && (
              events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/5 rounded-[24px] bg-white/[0.01] px-6 gap-4 select-none">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-500/10 to-amber-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
                    <Calendar size={26} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-200">Nenhum Compromisso Agendado</p>
                    <p className="text-[10px] text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                      Programe carregamentos, descarga, escalas e folgas. Mantemos tudo organizado e sincronizado para você.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddEventModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl text-[10.5px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/15 hover:shadow-orange-500/25 transition-all cursor-pointer active:scale-95"
                  >
                    Adicionar Compromisso
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pb-32">
                  {events.map(event => (
                    <div
                      key={event.id}
                      className="p-4 rounded-2xl bg-gradient-to-r from-[#0A1C30]/15 to-[#030914]/15 backdrop-blur-xl border border-white/5 border-l-4 border-l-orange-500 shadow-md flex items-start justify-between gap-4 select-none relative"
                    >
                      <div className="flex-1 min-w-0 space-y-1 text-left">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-[#0B1E36] border border-orange-500/20 text-[9px] font-black text-orange-400 flex items-center gap-1">
                            <Clock size={10} />
                            {event.time || '12:00'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold">
                            {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <h4 className="text-xs font-black uppercase text-white tracking-wide break-words">
                          {event.title}
                        </h4>
                        {event.description && (
                          <p className="text-[10px] text-gray-300 leading-relaxed font-medium mt-1 break-words">
                            {event.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleDeleteEvent(event.id, e)}
                        className="p-2 rounded bg-white/5 hover:bg-rose-500/15 text-gray-500 hover:text-rose-400 transition cursor-pointer shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ==================== NOTES VIEW ==================== */}
            {activeTab === 'notes' && (
              notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/5 rounded-[24px] bg-white/[0.01] px-6 gap-4 select-none">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-500/10 to-amber-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
                    <Notebook size={26} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-200">Nenhuma Nota Encontrada</p>
                    <p className="text-[10px] text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                      Anote contatos, placas, rotas, lembretes de pedágios ou instruções de terminais portuários.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddNoteModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl text-[10.5px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/15 hover:shadow-orange-500/25 transition-all cursor-pointer active:scale-95"
                  >
                    Criar Primeira Nota
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pb-32">
                  {notes.map(note => {
                    // Match note styles based on hex color
                    const isOrange = note.color === '#f97316';
                    const isBlue = note.color === '#00A2FF';
                    const isGreen = note.color === '#10B981';
                    const isPurple = note.color === '#A855F7';
                    const isRed = note.color === '#EF4444';

                    let colorTheme = 'border-orange-500/20 text-orange-400';
                    if (isBlue) colorTheme = 'border-blue-500/20 text-blue-400';
                    if (isGreen) colorTheme = 'border-emerald-500/20 text-emerald-400';
                    if (isPurple) colorTheme = 'border-purple-500/20 text-purple-400';
                    if (isRed) colorTheme = 'border-rose-500/20 text-rose-400';

                    return (
                      <div
                        key={note.id}
                        onClick={() => setViewingNote(note)}
                        className={`p-3.5 rounded-2xl bg-[#0A1C30]/15 backdrop-blur-xl border ${colorTheme} flex flex-col justify-between gap-3 shadow-md hover:border-white/15 transition cursor-pointer select-none text-left`}
                      >
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-[11px] font-black uppercase tracking-wider text-white truncate">
                            {note.title}
                          </h4>
                          <p className="text-[9.5px] text-gray-300 leading-normal line-clamp-3 break-words font-medium">
                            {note.content}
                          </p>
                        </div>

                        <div className="flex justify-between items-center border-t border-white/5 pt-2 mt-auto">
                          <span className="text-[7.5px] text-gray-500 font-bold uppercase">
                            {new Date(note.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                          <button
                            onClick={(e) => handleDeleteNote(note.id, e)}
                            className="p-1 rounded bg-white/5 hover:bg-rose-500/15 text-gray-500 hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ==================== CHECKLISTS VIEW ==================== */}
            {activeTab === 'checklists' && (
              checklists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-white/5 rounded-[24px] bg-white/[0.01] px-6 gap-4 select-none">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-orange-500/10 to-amber-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shadow-inner">
                    <ListTodo size={26} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-200">Nenhum Checklist Criado</p>
                    <p className="text-[10px] text-gray-500 mt-1.5 max-w-xs leading-relaxed">
                      Crie checklists de manutenção preventiva ou viagem longa para garantir a segurança no trânsito.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddChecklistModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl text-[10.5px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/15 hover:shadow-orange-500/25 transition-all cursor-pointer active:scale-95"
                  >
                    Criar Novo Checklist
                  </button>
                </div>
              ) : (
                <div className="space-y-4.5 pb-32">
                  {checklists.map(checklist => {
                    const totalItems = checklist.items?.length || 0;
                    const completedItems = checklist.items?.filter(it => it.completed).length || 0;
                    const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

                    return (
                      <div
                        key={checklist.id}
                        className="p-4 rounded-2xl bg-gradient-to-b from-[#0A1C30]/15 to-[#030914]/15 backdrop-blur-xl border border-white/5 shadow-md flex flex-col gap-3.5 text-left select-none"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <h4 className="text-xs font-black uppercase tracking-wide text-white break-words leading-tight">
                              {checklist.title}
                            </h4>
                            <span className="text-[8.5px] text-gray-500 font-bold uppercase tracking-wider">
                              Criado em {new Date(checklist.createdAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteChecklist(checklist.id, e)}
                            className="p-2 rounded bg-white/5 hover:bg-rose-500/15 text-gray-500 hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5 select-none">
                          <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider">
                            <span className="text-gray-400">Progresso</span>
                            <span className={percent === 100 ? 'text-green-400' : 'text-orange-400'}>
                              {completedItems}/{totalItems} ({percent}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 rounded-full"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>

                        {/* Checklist items viewport */}
                        <div className="space-y-2 pt-1 border-t border-white/5">
                          {checklist.items?.map(item => (
                            <div
                              key={item.id}
                              onClick={() => handleToggleChecklistItem(checklist.id, item.id)}
                              className="flex items-start gap-2.5 py-1.5 cursor-pointer group"
                            >
                              <button
                                className="w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 mt-0.5"
                                style={{
                                  backgroundColor: item.completed ? '#f97316' : 'rgba(0,0,0,0.3)',
                                  borderColor: item.completed ? '#f97316' : 'rgba(255,255,255,0.15)'
                                }}
                              >
                                {item.completed && <Check size={12} className="text-white" strokeWidth={3} />}
                              </button>
                              <span className={`text-xs font-semibold leading-tight ${
                                item.completed ? 'line-through text-gray-500' : 'text-gray-200 group-hover:text-white'
                              } break-words`}>
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Floating Action Bar when Tickets are Selected */}
      <AnimatePresence>
        {activeTab === 'tickets' && selectedTicketIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-22 inset-x-0 w-full max-w-md mx-auto px-4 z-40"
          >
            <div className="p-4 rounded-2xl bg-[#09172B] border border-orange-500/40 shadow-2xl flex items-center justify-between gap-4 select-none">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-black uppercase text-orange-400 tracking-wider">
                  {selectedTicketIds.length} {selectedTicketIds.length === 1 ? 'Item selecionado' : 'Itens selecionados'}
                </span>
                <span className="text-[9px] text-gray-400">Exportar como PDF</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-lg shadow-orange-500/10"
                >
                  <FileDown size={12} />
                  Exportar PDF
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden File Input for Capture/Environment Camera */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {/* Persistent Floating Bottom Tab Action Trigger */}
      <div className="w-full max-w-md mx-auto px-4 pb-4 pt-1 shrink-0 z-30 relative select-none">
        {activeTab === 'tickets' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center gap-2.5 text-xs font-black uppercase tracking-widest text-white hover:opacity-95 cursor-pointer active:scale-98 transition shadow-lg shadow-orange-500/20"
          >
            <Camera size={16} />
            <span>Tirar Foto de Novo Ticket</span>
          </button>
        )}
        {activeTab === 'notes' && (
          <button
            onClick={() => setShowAddNoteModal(true)}
            className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center gap-2.5 text-xs font-black uppercase tracking-widest text-white hover:opacity-95 cursor-pointer active:scale-98 transition shadow-lg shadow-orange-500/20"
          >
            <Plus size={16} />
            <span>Criar Nova Nota Rápida</span>
          </button>
        )}
      </div>

      {/* Real-time Spinner HUD */}
      <AnimatePresence>
        {isUploading && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 p-6 select-none">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] uppercase tracking-widest text-gray-300 font-bold">{uploadProgressText}</span>
          </div>
        )}
      </AnimatePresence>

      {/* Toast HUD */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0B1E36] border border-orange-500/40 px-5 py-3 rounded-2xl shadow-xl shadow-black/40 z-50 text-[10.5px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-2 max-w-[90%]"
          >
            <Check size={14} className="text-green-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ======================================================= */}
      {/* MODALS VIEWPORT */}
      {/* ======================================================= */}

      {/* 1. SAVE TICKET MODAL */}
      <AnimatePresence>
        {showAddTicketModal && previewImage && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative p-5 flex flex-col gap-4 max-h-[90vh] select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Plus className="text-orange-400" size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Salvar Novo Ticket</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAddTicketModal(false);
                    setPreviewImage(null);
                  }}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSaveTicket} className="space-y-4 overflow-y-auto max-h-[70vh] pr-0.5 scrollbar-thin">
                <div className="relative aspect-[4/3] rounded-xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center">
                  <img 
                    src={previewImage} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-[7px] text-green-400 uppercase tracking-widest font-black">
                    Alta Resolução
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Notas / Observações</label>
                  <textarea
                    value={ticketDesc}
                    onChange={(e) => setTicketDesc(e.target.value)}
                    placeholder="Escreva observações sobre o ticket (placa, peso líquido, notas fiscais, etc...)"
                    rows={4}
                    maxLength={200}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-90 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-500/10 transition cursor-pointer"
                >
                  Salvar Com Segurança
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. ADD COMPROMISSO (EVENT) MODAL */}
      <AnimatePresence>
        {showAddEventModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative p-5 flex flex-col gap-4 max-h-[90vh] select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Calendar className="text-orange-400" size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Agendar Compromisso</h3>
                </div>
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Título do Compromisso</label>
                  <input
                    type="text"
                    required
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="Ex: Carregamento Copadubo"
                    maxLength={50}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Data</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Horário</label>
                    <input
                      type="time"
                      required
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Descrição / Notas do Local</label>
                  <textarea
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    placeholder="Ex: Pegar senha na portaria 2, placa do reboque..."
                    rows={3}
                    maxLength={200}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-90 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-500/10 transition cursor-pointer"
                >
                  Confirmar Agendamento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. ADD NOTE MODAL */}
      <AnimatePresence>
        {showAddNoteModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative p-5 flex flex-col gap-4 max-h-[90vh] select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Notebook className="text-orange-400" size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Criar Nova Nota</h3>
                </div>
                <button
                  onClick={() => setShowAddNoteModal(false)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSaveNote} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Título da Nota</label>
                  <input
                    type="text"
                    required
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Ex: Placa da Carreta e Contatos"
                    maxLength={50}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Conteúdo</label>
                  <textarea
                    required
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Digite suas anotações aqui..."
                    rows={4}
                    maxLength={500}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-none"
                  />
                </div>

                {/* Predefined Note Color Selector */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1">
                    <Palette size={11} />
                    Cor de Destaque
                  </label>
                  <div className="flex items-center gap-3 pl-1">
                    {[
                      { hex: '#f97316', label: 'Laranja' },
                      { hex: '#00A2FF', label: 'Azul' },
                      { hex: '#10B981', label: 'Verde' },
                      { hex: '#A855F7', label: 'Roxo' },
                      { hex: '#EF4444', label: 'Vermelho' }
                    ].map(color => (
                      <button
                        key={color.hex}
                        type="button"
                        onClick={() => setNoteColor(color.hex)}
                        className="w-6 h-6 rounded-full transition-transform active:scale-90 relative flex items-center justify-center border border-white/15 cursor-pointer shadow-sm"
                        style={{ backgroundColor: color.hex }}
                        title={color.label}
                      >
                        {noteColor === color.hex && (
                          <div className="w-2.5 h-2.5 rounded-full bg-black" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2 py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-90 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-500/10 transition cursor-pointer"
                >
                  Salvar Nota
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. ADD CHECKLIST MODAL */}
      <AnimatePresence>
        {showAddChecklistModal && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative p-5 flex flex-col gap-4 max-h-[92vh] select-none"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <ListTodo className="text-orange-400" size={16} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white">Novo Checklist</h3>
                </div>
                <button
                  onClick={() => {
                    setShowAddChecklistModal(false);
                    setChecklistTitle('');
                    setTempChecklistItems([]);
                  }}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto max-h-[75vh] pr-0.5 scrollbar-thin text-left">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Título da Lista</label>
                  <input
                    type="text"
                    required
                    value={checklistTitle}
                    onChange={(e) => setChecklistTitle(e.target.value)}
                    placeholder="Ex: Checklist Pré-Viagem Longa"
                    maxLength={50}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                {/* Sub-form to Add checklist item */}
                <form onSubmit={handleAddTempChecklistItem} className="space-y-1.5 pt-2 border-t border-white/5">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pl-1">Adicionar Item de Tarefa</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItemText}
                      onChange={(e) => setNewChecklistItemText(e.target.value)}
                      placeholder="Ex: Verificar calibragem dos pneus"
                      maxLength={100}
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                    />
                    <button
                      type="submit"
                      className="px-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-[10px] font-extrabold uppercase tracking-widest text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </form>

                {/* List of items drafted so far */}
                {tempChecklistItems.length > 0 && (
                  <div className="space-y-1.5 bg-black/20 p-3 rounded-2xl border border-white/5 max-h-[22vh] overflow-y-auto">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 block pb-1">Items da Lista ({tempChecklistItems.length})</span>
                    <div className="space-y-2">
                      {tempChecklistItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center gap-3">
                          <span className="text-xs text-gray-200 truncate pr-2">• {item}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTempChecklistItem(idx)}
                            className="p-1 rounded bg-white/5 hover:bg-rose-500/15 text-gray-400 hover:text-rose-400 transition cursor-pointer"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveChecklist}
                  disabled={!checklistTitle.trim() || tempChecklistItems.length === 0}
                  className={`w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:opacity-90 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-orange-500/10 transition cursor-pointer flex items-center justify-center gap-2 ${
                    (!checklistTitle.trim() || tempChecklistItems.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <CheckSquare size={13} />
                  <span>Salvar Checklist Completo</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. DETAILED VIEW TICKET MODAL */}
      <AnimatePresence>
        {viewingTicket && (
          <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative p-5 flex flex-col gap-4 max-h-[92vh]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5 select-none">
                <div className="flex items-center gap-2">
                  <FileText className="text-orange-400" size={15} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white truncate max-w-[200px]">
                    Visualizar Ticket
                  </h3>
                </div>
                <button
                  onClick={() => setViewingTicket(null)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-auto rounded-xl bg-black border border-white/5 flex items-center justify-center relative min-h-[250px] max-h-[45vh]">
                <img 
                  src={viewingTicket.imageUrl} 
                  alt="Ticket" 
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="bg-[#030914]/55 p-3.5 rounded-xl border border-white/5 text-left select-none space-y-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400">Notas / Observações</span>
                <p className="text-xs text-gray-200 font-medium leading-relaxed break-words">
                  {viewingTicket.description || "Nenhuma nota adicionada neste ticket."}
                </p>
                <div className="pt-2 border-t border-white/5 mt-2 flex justify-between text-[8px] font-bold uppercase tracking-wider text-gray-500">
                  <span>Registrado em {new Date(viewingTicket.createdAt).toLocaleDateString('pt-BR')}</span>
                  <span>Por {userName}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 select-none">
                <button
                  onClick={() => handleExportSinglePDF(viewingTicket)}
                  className="py-2.5 bg-[#00A2FF] hover:bg-[#008fe0] text-black rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#00A2FF]/10 animate-pulse"
                >
                  <FileText size={12} />
                  Gerar PDF
                </button>

                <button
                  onClick={(e) => handleDeleteTicket(viewingTicket.id, e)}
                  className="py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/20"
                >
                  <Trash2 size={12} />
                  Excluir Ticket
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. DETAILED VIEW NOTE MODAL */}
      <AnimatePresence>
        {viewingNote && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A1C30] border border-white/10 rounded-[28px] w-full max-w-sm overflow-hidden shadow-2xl relative p-5 flex flex-col gap-4 max-h-[85vh] text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Notebook className="text-orange-400" size={15} />
                  <h3 className="text-xs font-black uppercase tracking-widest text-white truncate max-w-[200px]">
                    Visualizar Nota
                  </h3>
                </div>
                <button
                  onClick={() => setViewingNote(null)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3.5 overflow-y-auto max-h-[55vh] pr-0.5 scrollbar-thin">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white uppercase tracking-wide break-all">
                    {viewingNote.title}
                  </h4>
                  <span className="text-[8px] text-gray-500 font-extrabold uppercase shrink-0">
                    {new Date(viewingNote.createdAt).toLocaleDateString('pt-BR')} {new Date(viewingNote.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div 
                  className="p-4 rounded-2xl bg-black/35 border border-white/5 text-gray-200 text-xs font-medium leading-relaxed break-words whitespace-pre-wrap select-text selection:bg-orange-500 selection:text-white"
                  style={{ borderLeft: `4px solid ${viewingNote.color || '#f97316'}` }}
                >
                  {viewingNote.content}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={() => {
                    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `📋 *PORTO CONECTA - ANOTAÇÃO RÁPIDA*\n\n` +
                      `👤 *Motorista:* ${userName}\n` +
                      `🏷️ *Título:* ${viewingNote.title}\n` +
                      `📝 *Conteúdo:*\n${viewingNote.content}\n\n` +
                      `📌 _Nota salva e sincronizada com segurança._`
                    )}`;
                    window.open(whatsappUrl, '_blank');
                  }}
                  className="py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-green-600/10"
                >
                  <Share2 size={12} />
                  WhatsApp
                </button>

                <button
                  onClick={(e) => handleDeleteNote(viewingNote.id, e)}
                  className="py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest text-center transition flex items-center justify-center gap-1.5 cursor-pointer border border-rose-500/20"
                >
                  <Trash2 size={12} />
                  Excluir Nota
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
