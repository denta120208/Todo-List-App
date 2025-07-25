import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB9nip4NmKdSUFA23ajtoGOZCOIsDzLLJ8",
  authDomain: "sistem-informasi-karyawa-96da1.firebaseapp.com",
  databaseURL: "https://sistem-informasi-karyawa-96da1-default-rtdb.firebaseio.com",
  projectId: "sistem-informasi-karyawa-96da1",
  storageBucket: "sistem-informasi-karyawa-96da1.firebasestorage.app",
  messagingSenderId: "609979568042",
  appId: "1:609979568042:web:14f8ab016a352f479165d3",
  measurementId: "G-ZBH6ZRX4TX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class FirebaseService {
  // Collection name
  static COLLECTION_NAME = 'todos';

  // Add a new task
  static async addTask(task) {
    try {
      const taskWithTimestamp = {
        ...task,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), taskWithTimestamp);
      console.log('Task added with ID: ', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error adding task: ', error);
      throw error;
    }
  }

  // Get all tasks
  static async getTasks() {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const tasks = [];
      
      querySnapshot.forEach((doc) => {
        tasks.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return tasks;
    } catch (error) {
      console.error('Error getting tasks: ', error);
      throw error;
    }
  }

  // Toggle task completion
  static async toggleTask(taskId, currentStatus) {
    try {
      const taskRef = doc(db, this.COLLECTION_NAME, taskId);
      await updateDoc(taskRef, {
        completed: !currentStatus,
        updatedAt: serverTimestamp()
      });
      console.log('Task toggled: ', taskId);
    } catch (error) {
      console.error('Error toggling task: ', error);
      throw error;
    }
  }

  // Delete a task
  static async deleteTask(taskId) {
    try {
      await deleteDoc(doc(db, this.COLLECTION_NAME, taskId));
      console.log('Task deleted: ', taskId);
    } catch (error) {
      console.error('Error deleting task: ', error);
      throw error;
    }
  }

  // Set task priority
  static async setPriority(taskId, priority) {
    try {
      const taskRef = doc(db, this.COLLECTION_NAME, taskId);
      await updateDoc(taskRef, {
        priority: priority,
        updatedAt: serverTimestamp()
      });
      console.log('Task priority updated: ', taskId, priority);
    } catch (error) {
      console.error('Error setting priority: ', error);
      throw error;
    }
  }

  // Subscribe to real-time task updates
  static subscribeToTasks(callback) {
    try {
      const q = query(collection(db, this.COLLECTION_NAME), orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const tasks = [];
        querySnapshot.forEach((doc) => {
          tasks.push({
            id: doc.id,
            ...doc.data()
          });
        });
        callback(tasks);
      }, (error) => {
        console.error('Error in real-time listener: ', error);
        callback([]);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up real-time listener: ', error);
      return () => {};
    }
  }

  // Get Firebase app instance
  static getApp() {
    return app;
  }

  // Get Firestore instance
  static getDb() {
    return db;
  }
}

export default FirebaseService;
