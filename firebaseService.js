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
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from "firebase/auth";

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
const auth = getAuth(app);

class FirebaseService {
  // Collection name
  static COLLECTION_NAME = 'users';
  
  // Current user ID
  static currentUserId = null;
  
  // Initialize authentication
  static async initAuth() {
    try {
      console.log('Starting authentication...');
      
      // Check if user is already signed in
      if (auth.currentUser) {
        this.currentUserId = auth.currentUser.uid;
        console.log('User already authenticated:', this.currentUserId);
        return this.currentUserId;
      }
      
      // Sign in anonymously
      console.log('Signing in anonymously...');
      const result = await signInAnonymously(auth);
      this.currentUserId = result.user.uid;
      console.log('Anonymous user created:', this.currentUserId);
      
      return this.currentUserId;
    } catch (error) {
      console.error('Auth error:', error);
      throw error;
    }
  }
  
  // Get user-specific collection reference
  static getUserCollection() {
    if (!this.currentUserId) {
      throw new Error('User not authenticated');
    }
    return collection(db, this.COLLECTION_NAME, this.currentUserId, 'todos');
  }

  // Add a new task
  static async addTask(task) {
    try {
      // Ensure user is authenticated
      if (!this.currentUserId) {
        console.log('User not authenticated, re-initializing...');
        await this.initAuth();
      }
      
      const taskWithTimestamp = {
        ...task,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      console.log('Adding task for user:', this.currentUserId);
      const docRef = await addDoc(this.getUserCollection(), taskWithTimestamp);
      console.log('Task added with ID: ', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error adding task: ', error);
      
      // Retry once if authentication failed
      if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
        console.log('Authentication error, retrying...');
        try {
          await this.initAuth();
          const docRef = await addDoc(this.getUserCollection(), taskWithTimestamp);
          console.log('Task added with ID after retry: ', docRef.id);
          return docRef.id;
        } catch (retryError) {
          console.error('Retry failed:', retryError);
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  // Get all tasks
  static async getTasks() {
    try {
      const q = query(this.getUserCollection(), orderBy('createdAt', 'desc'));
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
      const taskRef = doc(this.getUserCollection(), taskId);
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
      await deleteDoc(doc(this.getUserCollection(), taskId));
      console.log('Task deleted: ', taskId);
    } catch (error) {
      console.error('Error deleting task: ', error);
      throw error;
    }
  }

  // Set task priority
  static async setPriority(taskId, priority) {
    try {
      const taskRef = doc(this.getUserCollection(), taskId);
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
      const q = query(this.getUserCollection(), orderBy('createdAt', 'desc'));
      
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
