// Firebase Configuration for Talia's Bakery order inquiries
// Backend project (legacy Firebase app name — forms submit to this project)
const firebaseConfig = {
  apiKey: "AIzaSyAdi1AR0Tjromwh2hshTTMsHB735r_2uPA",
  authDomain: "sweet-bites-delights.firebaseapp.com",
  projectId: "sweet-bites-delights",
  storageBucket: "sweet-bites-delights.firebasestorage.app",
  messagingSenderId: "136125120606",
  appId: "1:136125120606:web:6b900bb68cd3f57f4634cf",
  measurementId: "G-EQ4XY4VDQE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Storage
const storage = firebase.storage();

// Firebase only - no EmailJS

// Firebase Functions
class FirebaseService {
  constructor() {
    this.db = db;
    this.storage = storage;
  }

  // Submit inquiry to Firestore
  async submitInquiry(inquiryData) {
    try {
      const docRef = await this.db.collection('inquiries').add({
        ...inquiryData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'new'
      });

      console.log('Inquiry submitted successfully:', docRef.id);

      // Store inquiry data in Firebase (no email)
      await this.storeInquiryData(inquiryData);

      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error submitting inquiry:', error);
      throw error;
    }
  }

  // Upload image to Firebase Storage
  async uploadImage(file, inquiryId) {
    try {
      const fileName = `inquiries/${inquiryId}/${Date.now()}_${file.name}`;
      const storageRef = this.storage.ref().child(fileName);
      const snapshot = await storageRef.put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();

      console.log('Image uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // Upload multiple images
  async uploadImages(files, inquiryId) {
    try {
      const uploadPromises = Array.from(files).map(file =>
        this.uploadImage(file, inquiryId)
      );
      const downloadURLs = await Promise.all(uploadPromises);

      console.log('All images uploaded successfully:', downloadURLs);
      return downloadURLs;
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    }
  }

  // Submit inquiry with images
  async submitInquiryWithImages(inquiryData, imageFiles = []) {
    try {
      // First, create the inquiry document
      const docRef = await this.db.collection('inquiries').add({
        ...inquiryData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'new',
        hasImages: imageFiles.length > 0
      });

      let imageURLs = [];
      // If there are images, upload them
      if (imageFiles.length > 0) {
        imageURLs = await this.uploadImages(imageFiles, docRef.id);

        // Update the inquiry with image URLs
        await this.db.collection('inquiries').doc(docRef.id).update({
          images: imageURLs
        });
      }

      console.log('Inquiry with images submitted successfully:', docRef.id);

      // Store inquiry data with images in Firebase (no email)
      await this.storeInquiryData(inquiryData, imageURLs);

      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error submitting inquiry with images:', error);
      throw error;
    }
  }

  // Submit order to Firestore
  async submitOrder(orderData) {
    try {
      const docRef = await this.db.collection('orders').add({
        ...orderData,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });

      console.log('Order submitted successfully:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Error submitting order:', error);
      throw error;
    }
  }

  // Get all inquiries (for admin dashboard)
  async getInquiries() {
    try {
      const snapshot = await this.db.collection('inquiries')
        .orderBy('timestamp', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting inquiries:', error);
      throw error;
    }
  }

  // Update inquiry status
  async updateInquiryStatus(inquiryId, status) {
    try {
      await this.db.collection('inquiries').doc(inquiryId).update({
        status: status,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('Inquiry status updated:', inquiryId, status);
      return { success: true };
    } catch (error) {
      console.error('Error updating inquiry status:', error);
      throw error;
    }
  }

  // Delete inquiry and its images
  async deleteInquiry(inquiryId) {
    try {
      // Get the inquiry to check for images
      const inquiryDoc = await this.db.collection('inquiries').doc(inquiryId).get();
      const inquiryData = inquiryDoc.data();

      // Delete images from storage if they exist
      if (inquiryData.images && inquiryData.images.length > 0) {
        const deletePromises = inquiryData.images.map(imageURL => {
          const imageRef = this.storage.refFromURL(imageURL);
          return imageRef.delete();
        });
        await Promise.all(deletePromises);
      }

      // Delete the inquiry document
      await this.db.collection('inquiries').doc(inquiryId).delete();

      console.log('Inquiry and images deleted successfully:', inquiryId);
      return { success: true };
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      throw error;
    }
  }

  // Store inquiry data in Firebase (no email sending)
  async storeInquiryData(inquiryData, imageURLs = []) {
    try {
      // The inquiry is already stored in Firestore, just log success
      console.log('Inquiry data stored successfully in Firebase');
      console.log('Customer:', inquiryData.name, '(', inquiryData.email, ')');
      console.log('Service:', inquiryData.service_type);
      console.log('Event Date:', inquiryData.event_date);

      if (imageURLs.length > 0) {
        console.log('Images uploaded:', imageURLs.length, 'files');
      }

      return { success: true, message: 'Inquiry stored in Firebase' };
    } catch (error) {
      console.error('Error storing inquiry data:', error);
      return { success: false, error: error.message };
    }
  }

  // Format inquiry data for email
  formatInquiryEmail(inquiryData, imageURLs = []) {
    let emailContent = `New inquiry received from ${inquiryData.name} (${inquiryData.email})\n\n`;

    emailContent += `Service Type: ${inquiryData.service_type || 'Not specified'}\n`;
    emailContent += `Event Type: ${inquiryData.event_type || 'Not specified'}\n`;
    emailContent += `Event Date: ${inquiryData.event_date || 'Not specified'}\n`;
    emailContent += `Guest Count: ${inquiryData.guest_count || 'Not specified'}\n`;
    emailContent += `Budget Range: ${inquiryData.budget_range || 'Not specified'}\n`;
    emailContent += `Urgency: ${inquiryData.urgency || 'Not specified'}\n\n`;

    if (inquiryData.design_description) {
      emailContent += `Design Description:\n${inquiryData.design_description}\n\n`;
    }

    if (inquiryData.flavor_preference) {
      emailContent += `Flavor Preferences:\n${inquiryData.flavor_preference}\n\n`;
    }

    if (inquiryData.special_requirements) {
      emailContent += `Special Requirements:\n${inquiryData.special_requirements}\n\n`;
    }

    if (inquiryData.additional_notes) {
      emailContent += `Additional Notes:\n${inquiryData.additional_notes}\n\n`;
    }

    emailContent += `Contact Information:\n`;
    emailContent += `Phone: ${inquiryData.phone || 'Not provided'}\n`;
    emailContent += `Preferred Contact: ${inquiryData.preferred_contact || 'Not specified'}\n`;
    emailContent += `How they heard about us: ${inquiryData.how_did_you_hear || 'Not specified'}\n\n`;

    // Add image information
    if (imageURLs && imageURLs.length > 0) {
      emailContent += `📸 INSPIRATION PHOTOS (${imageURLs.length} images):\n`;
      emailContent += `The customer has uploaded ${imageURLs.length} inspiration photo(s).\n`;
      emailContent += `You can view these images in the admin dashboard or use the direct links below:\n\n`;

      imageURLs.forEach((url, index) => {
        emailContent += `Image ${index + 1}: ${url}\n`;
      });
      emailContent += `\n`;
    }

    emailContent += `Submitted at: ${new Date().toLocaleString()}`;

    return emailContent;
  }

  // Send email notification (using Firebase Functions)
  async sendEmailNotification(data) {
    try {
      // This would call a Firebase Function to send emails
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      return await response.json();
    } catch (error) {
      console.error('Error sending email notification:', error);
      throw error;
    }
  }

  // Firebase-only inquiry submission (no email)
  async submitInquiryFirebaseOnly(inquiryData, imageURLs = []) {
    try {
      // Store inquiry data and log details
      await this.storeInquiryData(inquiryData, imageURLs);

      // You can add Firebase Functions here later if you want email notifications
      // For now, all data is stored in Firebase and viewable in your admin dashboard

      return { success: true, message: 'Inquiry submitted to Firebase successfully' };
    } catch (error) {
      console.error('Error in Firebase-only submission:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize Firebase Service
const firebaseService = new FirebaseService();

// Export for use in other files
window.firebaseService = firebaseService; 