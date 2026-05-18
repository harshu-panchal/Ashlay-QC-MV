import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import path from 'path';
import { fileURLToPath } from 'url';
import Admin from '../app/models/admin.js';
import Seller from '../app/models/seller.js';
import Delivery from '../app/models/delivery.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configure DNS to resolve MongoDB Atlas correctly in all environments
try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    console.log('[DNS] Public DNS servers configured successfully');
} catch (error) {
    console.warn('[DNS] Failed to set custom DNS servers:', error?.message || error);
}

const admins = [
    { name: 'Ankit Ahirwar', email: 'ankit@appzeto.com', password: 'Admin!@#123' },
    { name: 'Harshvardhan Panchal', email: 'harshvardhanpanc145@gmail.com', password: 'Admin!@#123' }
];

const sellers = [
    { name: 'Harsh', email: 'harsh@appzeto.com', password: 'Admin!@#123', shopName: 'Appzeto Store' }
];

const deliveryBoys = [
    {
        name: 'Test Rider 1',
        phone: '6268423925',
        vehicleType: 'bike',
        email: 'rider1@appzeto.com',
        address: 'Indore, MP, India',
        isVerified: true,
        isActive: true,
        applicationStatus: 'approved'
    },
    {
        name: 'Test Rider 2',
        phone: '9111966732',
        vehicleType: 'scooter',
        email: 'rider2@appzeto.com',
        address: 'Bhopal, MP, India',
        isVerified: true,
        isActive: true,
        applicationStatus: 'approved'
    },
    {
        name: 'Test Rider 1 Intl',
        phone: '+916268423925',
        vehicleType: 'bike',
        email: 'rider1_intl@appzeto.com',
        address: 'Indore, MP, India',
        isVerified: true,
        isActive: true,
        applicationStatus: 'approved'
    },
    {
        name: 'Test Rider 2 Intl',
        phone: '+919111966732',
        vehicleType: 'scooter',
        email: 'rider2_intl@appzeto.com',
        address: 'Bhopal, MP, India',
        isVerified: true,
        isActive: true,
        applicationStatus: 'approved'
    }
];

async function seed() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
        if (!mongoUri) {
            throw new Error('MONGO_URI env variable is missing');
        }
        
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        for (const adminData of admins) {
            let admin = await Admin.findOne({ email: adminData.email });
            if (admin) {
                admin.password = adminData.password;
                await admin.save();
                console.log(`Updated Admin: ${adminData.email}`);
            } else {
                await Admin.create({ ...adminData, role: 'admin', isVerified: true });
                console.log(`Created Admin: ${adminData.email}`);
            }
        }

        for (const sellerData of sellers) {
            let seller = await Seller.findOne({ email: sellerData.email });
            if (seller) {
                seller.password = sellerData.password;
                seller.isVerified = true;
                seller.isActive = true;
                seller.applicationStatus = 'approved';
                await seller.save();
                console.log(`Updated Seller: ${sellerData.email}`);
            } else {
                await Seller.create({ 
                    ...sellerData, 
                    role: 'seller', 
                    isVerified: true, 
                    isActive: true, 
                    applicationStatus: 'approved',
                    phone: '9999999999' 
                });
                console.log(`Created Seller: ${sellerData.email}`);
            }
        }

        for (const deliveryData of deliveryBoys) {
            let rider = await Delivery.findOne({ phone: deliveryData.phone });
            if (rider) {
                rider.isVerified = true;
                rider.isActive = true;
                rider.applicationStatus = 'approved';
                await rider.save();
                console.log(`Updated Delivery Rider: ${deliveryData.phone}`);
            } else {
                await Delivery.create(deliveryData);
                console.log(`Created Delivery Rider: ${deliveryData.phone}`);
            }
        }

        console.log('Seeding completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
}

seed();
