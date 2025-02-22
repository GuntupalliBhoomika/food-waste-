const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  }
});

// Initialize multer upload
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const User = require('./models/User');
const ContactMessage = require('./models/ContactMessage');
const NGO = require('./models/NGOModel');
const Donor = require('./models/DonorModel');
const Listing = require('./models/Listing');

const app = express();
const port = 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/foodwaste', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Redirect root route to home.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ name, email, password });
    await user.save();
    
    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    req.session.userId = user._id;
    res.json({ message: 'Login successful', user: { name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logout successful' });
  });
});

// NGO Registration route
app.post('/submit-ngo', async (req, res) => {
  try {
    const { orgName, contactPerson, email, phone } = req.body;
    
    const ngo = new NGO({ orgName, contactPerson, email, phone });
    await ngo.save();
    
    res.status(201).json({ message: 'NGO registration successful' });
  } catch (error) {
    res.status(500).json({ message: 'NGO registration failed', error: error.message });
  }
});

// Donor Registration route
app.post('/submit-donor', async (req, res) => {
  try {
    const { donorName, donorEmail, donorPhone } = req.body;
    
    const donor = new Donor({ donorName, donorEmail, donorPhone });
    await donor.save();
    
    res.status(201).json({ 
      message: 'Donor registration successful',
      donorId: donor._id 
    });
  } catch (error) {
    res.status(500).json({ message: 'Donor registration failed', error: error.message });
  }
});

// Listing routes
app.post('/api/listings', upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, quantity, expirationDate, location } = req.body;
    const owner = req.session.userId;
    
    if (!owner) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const images = req.files ? req.files.map(file => '/uploads/' + file.filename) : [];
    
    const listing = new Listing({ 
      title,
      description,
      quantity,
      expirationDate,
      location,
      owner,
      images
    });

    await listing.save();
    res.status(201).json({ 
      message: 'Listing created successfully', 
      listing: {
        ...listing.toObject(),
        images: listing.images.map(img => process.env.BASE_URL + img)
      }
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to create listing', 
      error: error.message,
      details: error.errors || error
    });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings);
  } catch ( error) {
    res.status(500).json({ message: 'Failed to fetch listings', error: error.message });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    res.json(listing);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch listing', error: error.message });
  }
});

app.put('/api/listings/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    res.json({ message: 'Listing updated successfully', listing });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update listing', error: error.message });
  }
});

app.delete('/api/listings/:id', async (req, res) => {
  try {
    const listing = await Listing.findByIdAndDelete(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }
    res.json({ message: 'Listing deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete listing', error: error.message });
  }
});

// Contact form submission route
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        message: 'All fields are required',
        details: { name, email, subject, message }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: 'Invalid email format',
        email: email 
      });
    }

    // Create new contact message
    const contactMessage = new ContactMessage({
      name,
      email,
      subject,
      message
    });

    await contactMessage.save();
    res.status(201).json({ 
      message: 'Message received successfully',
      contactId: contactMessage._id
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to send message',
      error: error.message,
      details: {
        validation: {
          name: !!name,
          email: !!email,
          subject: !!subject,
          message: !!message
        }
      }
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
