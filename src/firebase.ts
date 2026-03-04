import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDU6MxE3aUtbJ-OkY8CGRgqeXYZe-ilfzw",
  authDomain: "labnotes-e2efa.firebaseapp.com",
  projectId: "labnotes-e2efa",
  storageBucket: "labnotes-e2efa.firebasestorage.app",
  messagingSenderId: "335522715470",
  appId: "1:335522715470:web:aebd219bfee4dc275a701f",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const firestore = getFirestore(app)
