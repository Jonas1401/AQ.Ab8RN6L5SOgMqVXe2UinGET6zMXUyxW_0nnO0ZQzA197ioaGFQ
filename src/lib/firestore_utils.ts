import { doc, setDoc, deleteDoc, db } from './db';

export async function syncTicketToFirestore(userId: string, ticket: any) {
  const docRef = doc(db, 'users', userId, 'tickets', ticket.id);
  await setDoc(docRef, { ...ticket, userId }, { merge: true });
}

export async function deleteTicketFromFirestore(userId: string, ticketId: string) {
  const docRef = doc(db, 'users', userId, 'tickets', ticketId);
  await deleteDoc(docRef);
}

export async function syncEventToFirestore(userId: string, event: any) {
  const docRef = doc(db, 'users', userId, 'events', event.id);
  await setDoc(docRef, { ...event, userId }, { merge: true });
}

export async function deleteEventFromFirestore(userId: string, eventId: string) {
  const docRef = doc(db, 'users', userId, 'events', eventId);
  await deleteDoc(docRef);
}

export async function syncNoteToFirestore(userId: string, note: any) {
  const docRef = doc(db, 'users', userId, 'notes', note.id);
  await setDoc(docRef, { ...note, userId }, { merge: true });
}

export async function deleteNoteFromFirestore(userId: string, noteId: string) {
  const docRef = doc(db, 'users', userId, 'notes', noteId);
  await deleteDoc(docRef);
}

export async function syncChecklistToFirestore(userId: string, checklist: any) {
  const docRef = doc(db, 'users', userId, 'checklists', checklist.id);
  await setDoc(docRef, { ...checklist, userId }, { merge: true });
}

export async function deleteChecklistFromFirestore(userId: string, checklistId: string) {
  const docRef = doc(db, 'users', userId, 'checklists', checklistId);
  await deleteDoc(docRef);
}
