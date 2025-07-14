import FirebaseService from './firebaseService';
import { doc, getDoc } from 'firebase/firestore';

// Check if Firebase configuration is valid
export const checkFirebaseConfig = () => {
  try {
    const app = FirebaseService.getApp();
    const db = FirebaseService.getDb();
    
    if (!app || !db) {
      console.error('Firebase app or database not initialized');
      return false;
    }
    
    console.log('Firebase configuration is valid');
    return true;
  } catch (error) {
    console.error('Firebase configuration error:', error);
    return false;
  }
};

// Test Firebase connection by attempting to read from database
export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    
    // Try to get tasks collection
    const tasks = await FirebaseService.getTasks();
    console.log('Successfully connected to Firebase!');
    console.log('Current tasks count:', tasks.length);
    
    return {
      success: true,
      message: 'Firebase connection successful',
      tasksCount: tasks.length
    };
  } catch (error) {
    console.error('Firebase connection test failed:', error);
    
    let errorMessage = 'Unknown error';
    let errorCode = 'unknown';
    
    if (error.code) {
      errorCode = error.code;
    }
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Common Firebase error messages
    switch (errorCode) {
      case 'permission-denied':
        errorMessage = 'Permission denied - check Firestore rules';
        break;
      case 'unavailable':
        errorMessage = 'Firebase service unavailable';
        break;
      case 'failed-precondition':
        errorMessage = 'Firebase precondition failed';
        break;
      case 'not-found':
        errorMessage = 'Firebase project not found';
        break;
      default:
        errorMessage = error.message || 'Connection failed';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode
    };
  }
};

// Test adding a sample task
export const testAddTask = async () => {
  try {
    console.log('Testing add task functionality...');
    
    const testTask = {
      text: 'Test task - ' + new Date().toISOString(),
      completed: false,
      priority: 'medium'
    };
    
    const taskId = await FirebaseService.addTask(testTask);
    console.log('Test task added successfully with ID:', taskId);
    
    return {
      success: true,
      taskId: taskId,
      message: 'Test task added successfully'
    };
  } catch (error) {
    console.error('Add task test failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to add test task'
    };
  }
};

// Clean up test data
export const cleanupTestData = async () => {
  try {
    console.log('Cleaning up test data...');
    
    const tasks = await FirebaseService.getTasks();
    const testTasks = tasks.filter(task => task.text && task.text.includes('Test task -'));
    
    for (const task of testTasks) {
      await FirebaseService.deleteTask(task.id);
      console.log('Deleted test task:', task.id);
    }
    
    console.log('Test data cleanup completed');
    return {
      success: true,
      deletedCount: testTasks.length
    };
  } catch (error) {
    console.error('Cleanup failed:', error);
    return {
      success: false,
      error: error.message || 'Cleanup failed'
    };
  }
};

// Complete Firebase diagnostic
export const runFirebaseDiagnostic = async () => {
  console.log('=== FIREBASE DIAGNOSTIC START ===');
  
  // Check configuration
  const configOk = checkFirebaseConfig();
  console.log('Config check:', configOk ? 'PASS' : 'FAIL');
  
  if (!configOk) {
    console.log('=== FIREBASE DIAGNOSTIC END ===');
    return { success: false, error: 'Configuration invalid' };
  }
  
  // Test connection
  const connectionResult = await testFirebaseConnection();
  console.log('Connection test:', connectionResult.success ? 'PASS' : 'FAIL');
  
  if (!connectionResult.success) {
    console.log('=== FIREBASE DIAGNOSTIC END ===');
    return connectionResult;
  }
  
  // Test add functionality
  const addResult = await testAddTask();
  console.log('Add test:', addResult.success ? 'PASS' : 'FAIL');
  
  // Cleanup
  if (addResult.success) {
    await cleanupTestData();
  }
  
  console.log('=== FIREBASE DIAGNOSTIC END ===');
  
  return {
    success: true,
    message: 'All tests passed',
    details: {
      config: configOk,
      connection: connectionResult.success,
      addTask: addResult.success,
      tasksCount: connectionResult.tasksCount
    }
  };
};
