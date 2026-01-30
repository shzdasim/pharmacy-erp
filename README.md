# Karobar-App 🏥💊

<div align="center">

![Karobar-App Logo](https://img.shields.io/badge/Karobar--App-POS%20for%20Pharmacy-blue?style=for-the-badge&logo=medicalcross)

**A comprehensive Point of Sale (POS) software for Pharmacies and Medical Stores**

[![Laravel](https://img.shields.io/badge/Laravel-12.x-FF2D20?style=flat-square&logo=laravel)](https://laravel.com)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite)](https://vitejs.dev)

</div>

---

## 📋 Table of Contents

- [About Karobar-App](#about-karobar-app)
- [✨ Features](#-features)
- [🛠 Tech Stack](#-tech-stack)
- [📦 Installation](#-installation)
- [⚙️ Configuration](#️-configuration)
- [🔐 Initial Setup](#-initial-setup)
- [📊 Reports](#-reports)
- [🔄 Auto-Update System](#-auto-update-system)
- [📁 Project Structure](#-project-structure)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## About Karobar-App

**Karobar-App** is a modern, full-featured Point of Sale (POS) and inventory management system designed specifically for **pharmacies and medical stores**. Built with Laravel 12 and React, it provides a complete solution for managing sales, purchases, inventory, customers, suppliers, and comprehensive reporting.

Whether you run a small pharmacy or a large medical store chain, Karobar-App helps you streamline operations, track inventory in real-time, and make data-driven decisions.

---

## ✨ Features

### 🏪 Point of Sale (POS)
- **Fast Billing**: Quick and efficient checkout process
- **Thermal Printer Support**: Print receipts on 58mm/80mm thermal printers
- **A4 Invoice Support**: Generate professional A4 invoices
- **Multiple Invoice Templates**: Standard, Minimal, Detailed, Compact, Bold, Barcode
- **Sale Returns**: Handle customer returns with ease
- **Invoice History**: View and search past invoices

### 📦 Inventory Management
- **Product Management**: Add/edit products with details
- **Batch Tracking**: Track products by batch numbers
- **Expiry Date Monitoring**: Alerts for near-expiry medicines
- **Stock Adjustments**: Add/reduce stock with justification
- **Category & Brand Management**: Organize products logically
- **Low Stock Alerts**: Never run out of essential medicines

### 👥 Customer Management
- **Customer Database**: Maintain customer records
- **Credit Management**: Track customer credit and payments
- **Customer Ledger**: Complete transaction history
- **SMS/Email Notifications**: (Coming soon)

### 🚚 Supplier Management
- **Supplier Database**: Manage supplier information
- **Supplier Ledger**: Track all transactions
- **Purchase Management**: Record purchases and returns
- **Supplier Performance Tracking**: Monitor supplier reliability

### 📊 Reports & Analytics
- **Sales Reports**: Daily, weekly, monthly sales summaries
- **Purchase Reports**: Purchase history and analysis
- **Inventory Reports**: Current stock, valuation, expiry reports
- **Profit & Loss**: Cost of sales and profit margins
- **Product Performance**: Top selling products analysis
- **Stock Movement**: Track stock adjustments

### 💾 Backup & Restore
- **Automated Backups**: Create full or partial backups
- **Cloud Storage Ready**: Backup to cloud storage
- **One-Click Restore**: Restore from previous backups
- **Scheduled Backups**: Configure automatic backup schedules

### 🔄 Auto-Update System
- **GitHub Integration**: Check for updates automatically
- **One-Click Updates**: Install updates with a single click
- **Release Notes**: View what's new before updating
- **Rollback Capability**: Restore previous version if needed

### 🔒 Security & Access Control
- **Role-Based Access**: Define user roles and permissions
- **User Management**: Create and manage system users
- **Activity Logging**: Track all user actions
- **License Management**: Protect your software investment

---

## 🛠 Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Laravel 12 (PHP 8.2+) |
| Frontend | React 18 with Vite |
| Database | SQLite (default) / PostgreSQL |
| Authentication | Laravel Sanctum |
| Permissions | Spatie Permission |
| Styling | Tailwind CSS |
| Icons | Heroicons |
| File Uploads | Filepond |
| PDF Generation | DomPDF |

---

## 📦 Installation

### Prerequisites

Before installing Karobar-App, ensure your system meets these requirements:

- **PHP**: 8.2 or higher
- **Composer**: Latest version
- **Node.js**: 18.x or higher
- **npm** or **yarn**
- **Git**: Latest version
- **Web Server**: Nginx or Apache (for production)
- **Database**: SQLite (development) or PostgreSQL (production)

### Step 1: Clone the Repository

```bash
# Navigate to your projects directory
cd /Users/yourdirectory/

# Clone the repository
git clone https://github.com/shzdasim/pharmacy-erp.git karobar-app

# Enter the project directory
cd karobar-app
```

### Step 2: Install PHP Dependencies

```bash
# Install Composer dependencies
composer install

# If you want development dependencies
# composer install --dev
```

### Step 3: Install JavaScript Dependencies

```bash
# Install npm dependencies
npm install

# Build the frontend assets
npm run build
```

### Step 4: Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Generate JWT secret (if using API authentication)
php artisan jwt:secret
```

### Step 5: Database Setup

#### For SQLite (Development)

No additional setup required. SQLite will be created automatically.

#### For PostgreSQL (Production)

Edit `.env` file and update database settings:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=karobar_app
DB_USERNAME=postgres
DB_PASSWORD=your_password
```

### Step 6: Run Migrations

```bash
# Run database migrations
php artisan migrate

# Seed the database with initial data
php artisan db:seed
```

### Step 7: Create Storage Link

```bash
# Create symbolic link for public storage
php artisan storage:link
```

### Step 8: Clear All Caches

```bash
# Clear all caches
php artisan optimize:clear

# Recache configuration
php artisan config:cache

# Recache routes
php artisan route:cache
```

### Step 9: Start the Development Server

```bash
# Start Laravel development server
php artisan serve

# In a separate terminal, start Vite dev server
npm run dev
```

### Access the Application

Open your browser and navigate to:
- **URL**: http://127.0.0.1:8000
- **Email**: admin@example.com
- **Password**: password

---

## ⚙️ Configuration

### Application Settings

Edit `.env` file to configure your application:

```env
# Application
APP_NAME="Karobar-App"
APP_URL=http://localhost:8000
APP_VERSION=1.0.0

# Database
DB_CONNECTION=sqlite
# DB_CONNECTION=pgsql

# Cache
CACHE_DRIVER=file
SESSION_DRIVER=file

# Filesystem
FILESYSTEM_DISK=local

# GitHub Auto-Update (Optional)
GITHUB_OWNER=shzdasim
GITHUB_REPO=pharmacy-erp
GITHUB_BRANCH=Sale-Invoice
```

### Printer Configuration

Configure your thermal printer in Settings → Printer Settings:

1. **Printer Type**: Thermal or A4
2. **Template**: Choose from 6 available templates:
   - **Standard**: Classic layout with logo
   - **Minimal**: No logo, basic info
   - **Detailed**: Extended customer & payment info
   - **Compact**: Small fonts, more items
   - **Bold**: Large fonts, high contrast
   - **Barcode**: With product barcodes & QR code

### Thermal Printer Size

Configure paper width in your printer settings:
- **58mm**: Small thermal printers
- **80mm**: Standard thermal printers

---

## 🔐 Initial Setup

### 1. Login with Default Credentials

After installation, login with:
- **Email**: admin@karobar.app
- **Password**: password

> ⚠️ **Important**: Change the default password immediately after first login!

### 2. Create Admin User

Navigate to **Settings → License** to activate your license and create admin users.

### 3. Configure Store Information

Navigate to **Settings → General** and configure:
- Store Name
- Phone Number
- Address
- License Number (if applicable)
- Invoice Footer Note

### 4. Upload Store Logo

In **Settings → General**, upload your store logo for thermal receipts.

### 5. Import Initial Data

#### Import Categories
1. Navigate to **Categories**
2. Click **Import**
3. Upload CSV file with category data

#### Import Brands
1. Navigate to **Brands**
2. Click **Import**
3. Upload CSV file with brand data

#### Import Suppliers
1. Navigate to **Suppliers**
2. Click **Import**
3. Upload CSV file with supplier data

#### Import Products
1. Navigate to **Products**
2. Click **Import**
3. Upload CSV file with product data

#### Import Customers
1. Navigate to **Customers**
2. Click **Import**
3. Upload CSV file with customer data

---

## 📊 Reports

Karobar-App provides comprehensive reports for business analysis:

### Available Reports

| Report | Description | Path |
|--------|-------------|------|
| **Cost of Sale** | Calculate profit margins | `/reports/cost-of-sale` |
| **Purchase Detail** | Detailed purchase transactions | `/reports/purchase-detail` |
| **Sale Detail** | Detailed sales transactions | `/reports/sale-detail` |
| **Current Stock** | Real-time stock levels | `/reports/current-stock` |
| **Stock Adjustment** | Stock adjustment history | `/reports/stock-adjustment` |
| **Product Comprehensive** | Complete product analysis | `/reports/product-comprehensive` |

### Generate Reports

1. Navigate to the desired report
2. Set date range filters
3. Apply additional filters (category, brand, etc.)
4. Click **Generate Report**
5. Export to PDF or print

### Purchase Order Forecast

Use **Purchase Orders** to generate forecasts:
1. Navigate to **Purchase Orders**
2. Configure forecast parameters
3. Generate and review forecast
4. Create purchase orders from forecast

---

## 🔄 Auto-Update System

Karobar-App includes a built-in auto-update system that checks GitHub for new releases.

### Enable Auto-Update

1. Navigate to **Settings → Updates**
2. Configure update settings:
   - **Auto-check for updates**: Enable/disable automatic checks
   - **Require confirmation**: Always ask before installing

### Manual Update

1. Go to **Settings → Updates**
2. Click **Check Now** to see if updates are available
3. Review release notes
4. Click **Install Update** to apply

### Create Release for Updates

To enable the update system, create a GitHub release:

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release v1.0.0

## Features
- Initial release of Karobar-App
- POS for pharmacies
- Inventory management
- Reports system
- Backup & restore"

# Push tag to GitHub
git push origin v1.0.0
```

### Version Numbering

Use semantic versioning:
- `v1.0.0` - First stable release
- `v1.0.1` - Bug fixes only
- `v1.1.0` - New features (backward compatible)
- `v2.0.0` - Breaking changes

---

## 📁 Project Structure

```
karobar-app/
├── app/
│   ├── Authorizables/         # Custom policy classes
│   ├── Console/               # Artisan commands
│   ├── Http/
│   │   ├── Controllers/       # API & Web controllers
│   │   └── Middleware/        # Custom middleware
│   ├── Models/                # Eloquent models
│   ├── Policies/              # Authorization policies
│   ├── Providers/             # Service providers
│   └── Services/              # Business logic
├── bootstrap/                 # Bootstrap files
├── config/                    # Configuration files
├── database/
│   ├── factories/             # Database factories
│   ├── migrations/            # Database migrations
│   └── seeders/               # Database seeders
├── resources/
│   ├── css/                   # Stylesheets
│   ├── js/
│   │   ├── api/               # API service files
│   │   ├── components/        # Reusable components
│   │   ├── context/           # React context
│   │   ├── layouts/           # Page layouts
│   │   ├── pages/             # Page components
│   │   └── routes/            # React Router config
│   └── views/                 # Blade templates
├── routes/                    # Route definitions
├── storage/                   # Storage files
├── tests/                     # Test files
├── composer.json              # PHP dependencies
├── package.json               # Node dependencies
└── vite.config.js             # Vite configuration
```

---

## 🤝 Contributing

We welcome contributions to improve Karobar-App!

### Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit pull requests

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Karobar-App is licensed under the MIT License.

---

## 📞 Support

For support, please:

1. Check the [Documentation](#-installation)
2. Search existing [Issues](https://github.com/shzdasim/pharmacy-erp/issues)
3. Create a new Issue if needed

---

<div align="center">

**Built with ❤️ for Pharmacies and Medical Stores**

**Karobar-App** - Your Complete Pharmacy Management Solution

</div>

