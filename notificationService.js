import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure notifications behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

class NotificationService {
  static async initialize() {
    try {
      // Check if running in Expo Go
      if (Constants.appOwnership === 'expo') {
        console.log('Running in Expo Go - notifications have limitations');
        return false;
      }

      // Request permissions
      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
          console.log('Failed to get push token for push notification!');
          return false;
        }
        
        console.log('Notification permissions granted');
        return true;
      } else {
        console.log('Must use physical device for Push Notifications');
        return false;
      }
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  // Schedule a notification for a task
  static async scheduleTaskNotification(task, alarmTime) {
    try {
      console.log('Scheduling notification for task:', task.text, 'at:', alarmTime);
      
      // Check if notifications are supported
      if (Constants.appOwnership === 'expo') {
        console.log('Expo Go detected - notification scheduling not available');
        return 'expo-go-mock-id';
      }
      
      // Cancel existing notification if any
      if (task.notificationId && task.notificationId !== 'expo-go-mock-id') {
        await Notifications.cancelScheduledNotificationAsync(task.notificationId);
      }
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Reminder Todo',
          body: task.text,
          sound: 'default',
          data: {
            taskId: task.id,
            taskText: task.text,
            priority: task.priority
          },
        },
        trigger: {
          date: new Date(alarmTime),
        },
      });
      
      console.log('Notification scheduled with ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  // Cancel a scheduled notification
  static async cancelTaskNotification(notificationId) {
    try {
      if (notificationId && notificationId !== 'expo-go-mock-id') {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        console.log('Notification cancelled:', notificationId);
      } else if (notificationId === 'expo-go-mock-id') {
        console.log('Mock notification cancelled for Expo Go');
      }
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  // Get all scheduled notifications
  static async getScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('Scheduled notifications:', notifications.length);
      return notifications;
    } catch (error) {
      console.error('Error getting scheduled notifications:', error);
      return [];
    }
  }

  // Cancel all notifications
  static async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  // Set up notification listeners
  static setupListeners(onNotificationReceived, onNotificationResponse) {
    // Listener for notifications received while app is in foreground
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for user interactions with notifications
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }

  // Schedule daily reminder notification
  static async scheduleDailyReminder(hour, minute, soundType = 'default') {
    try {
      console.log('Scheduling daily reminder at', hour, ':', minute);
      
      // Check if notifications are supported
      if (Constants.appOwnership === 'expo') {
        console.log('Expo Go detected - daily reminder scheduling not available');
        return 'expo-go-daily-reminder';
      }
      
      // Cancel existing daily reminder
      await this.cancelDailyReminder();
      
      // Create trigger for daily repeat
      const trigger = {
        hour: hour,
        minute: minute,
        repeats: true,
      };
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📋 Reminder Todo List',
          body: 'Waktunya check todo list Anda! Ada task yang perlu diselesaikan?',
          sound: soundType,
          priority: 'high',
          data: {
            type: 'daily_reminder',
            hour: hour,
            minute: minute
          },
        },
        trigger: trigger,
      });
      
      console.log('Daily reminder scheduled with ID:', notificationId);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling daily reminder:', error);
      return null;
    }
  }

  // Cancel daily reminder
  static async cancelDailyReminder() {
    try {
      // Get all scheduled notifications
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      
      // Find and cancel daily reminder
      for (const notification of scheduledNotifications) {
        if (notification.content.data?.type === 'daily_reminder') {
          await Notifications.cancelScheduledNotificationAsync(notification.identifier);
          console.log('Daily reminder cancelled:', notification.identifier);
        }
      }
    } catch (error) {
      console.error('Error cancelling daily reminder:', error);
    }
  }

  // Check if notification time is in the future
  static isValidAlarmTime(alarmTime) {
    const now = new Date();
    const alarm = new Date(alarmTime);
    return alarm.getTime() > now.getTime();
  }

  // Format alarm time for display
  static formatAlarmTime(alarmTime) {
    if (!alarmTime) return null;
    
    const date = new Date(alarmTime);
    const now = new Date();
    
    // Check if it's today
    const isToday = date.toDateString() === now.toDateString();
    
    // Check if it's tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    const timeString = date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    if (isToday) {
      return `Hari ini ${timeString}`;
    } else if (isTomorrow) {
      return `Besok ${timeString}`;
    } else {
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }
}

export default NotificationService;
