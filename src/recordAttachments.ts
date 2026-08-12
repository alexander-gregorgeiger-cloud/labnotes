// Photo attachments for conjugation records (ÄKTA chromatograms, FM sensograms).
//
// Images live in a subcollection rather than on the record document itself:
// a record can hold up to 15 tubes × 2 images, which would blow past the 1 MiB
// Firestore document limit if stored inline.

import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, getDocs, Timestamp,
} from 'firebase/firestore'
import { firestore } from './firebase'
import type { AttachmentKind, RecordAttachment } from './conjugationRecord'

// Firestore rejects documents over 1 MiB; stay well below with a resized JPEG.
const MAX_WIDTH = 1400
const JPEG_QUALITY = 0.8

/** Downscale an image file to a JPEG data URL suitable for Firestore storage. */
export function resizeToDataUrl(file: File, maxWidth = MAX_WIDTH): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new window.Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        // Chromatograms are usually screenshots on white — avoid black padding.
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function attachmentsRef(uid: string, recordId: string) {
  return collection(firestore, 'users', uid, 'conjugationRecords', recordId, 'attachments')
}

/** Live-subscribe to all attachments of a record. */
export function subscribeAttachments(
  uid: string,
  recordId: string,
  onChange: (items: RecordAttachment[]) => void
) {
  const q = query(attachmentsRef(uid, recordId), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        kind: data.kind as AttachmentKind,
        tubeIndex: data.tubeIndex ?? 0,
        dataUrl: data.dataUrl || '',
        createdAt: data.createdAt?.toDate() || new Date(),
      }
    }))
  })
}

export async function addAttachment(
  uid: string,
  recordId: string,
  kind: AttachmentKind,
  tubeIndex: number,
  file: File
) {
  const dataUrl = await resizeToDataUrl(file)
  await addDoc(attachmentsRef(uid, recordId), {
    kind, tubeIndex, dataUrl, createdAt: Timestamp.now(),
  })
}

export async function deleteAttachment(uid: string, recordId: string, attachmentId: string) {
  await deleteDoc(doc(attachmentsRef(uid, recordId), attachmentId))
}

/** Remove every attachment of a record — Firestore does not cascade deletes. */
export async function deleteAllAttachments(uid: string, recordId: string) {
  const snap = await getDocs(attachmentsRef(uid, recordId))
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
}
