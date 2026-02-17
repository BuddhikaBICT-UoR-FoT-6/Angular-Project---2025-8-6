# Angular Financial Management System

A comprehensive full-stack Angular application with integrated financial management, admin dashboard, and backend API services.

## 📋 Project Overview

This project is a modern web application built with Angular 19 for the frontend and Node.js/Express for the backend. It features a complete financial management system with revenue tracking, sales analytics, profit/loss calculations, tax management, and comprehensive reporting capabilities.

## 🚀 Features

### Financial Management Module
- **Revenue Reporting**: Track and analyze revenue streams with detailed breakdowns
- **Sales Analytics**: Comprehensive sales data visualization and insights
- **Profit & Loss Calculations**: Automated P&L statements with customizable date ranges
- **Tax Calculations**: Built-in tax computation with support for multiple tax rates
- **Financial Reports Export**: Generate and export reports in multiple formats (PDF, Excel, CSV)
- **Real-time Dashboard**: Interactive charts and graphs for financial metrics

### Admin Dashboard
- User management and authentication
- Role-based access control
- System configuration and settings
- Activity monitoring and logs

### Backend API
- RESTful API architecture
- MongoDB database integration
- Secure authentication and authorization
- Data validation and error handling
- Financial calculations and utilities

## 🛠️ Technology Stack

### Frontend
- **Framework**: Angular 19
- **Language**: TypeScript
- **Styling**: CSS3 with modern design patterns
- **HTTP Client**: Angular HttpClient
- **Routing**: Angular Router

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Language**: JavaScript (ES6+)

## 📁 Project Structure

```
Angular-Project---2025-8-6/
├── First_Project/
│   ├── src/
│   │   ├── app/
│   │   │   ├── admin/
│   │   │   │   └── financials/
│   │   │   │       ├── financials.component.ts
│   │   │   │       ├── financials.html
│   │   │   │       └── financials.css
│   │   │   ├── services/
│   │   │   │   └── financial.service.ts
│   │   │   └── app.component.ts
│   │   └── main.ts
│   ├── server/
│   │   ├── models/
│   │   │   └── financial.js
│   │   ├── routes/
│   │   │   └── financial.routes.js
│   │   ├── utils/
│   │   │   └── financialUtils.js
│   │   └── server.js
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
├── package.json
└── README.md
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- MongoDB (v6 or higher)
- Angular CLI (v19 or higher)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/BuddhikaBICT-UoR-FoT-6/Angular-Project---2025-8-6.git
   cd Angular-Project---2025-8-6
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Navigate to First_Project and install
   cd First_Project
   npm install
   ```

3. **Configure MongoDB**
   - Ensure MongoDB is running on your system
   - Update the database connection string in `server/server.js` if needed
   - Default connection: `mongodb://localhost:27017/financial_db`

4. **Environment Setup**
   Create a `.env` file in the `First_Project` directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/financial_db
   NODE_ENV=development
   ```

## 🚀 Running the Application

### Development Mode

1. **Start the Backend Server**
   ```bash
   cd First_Project
   node server/server.js
   ```
   The API server will run on `http://localhost:3000`

2. **Start the Angular Development Server**
   ```bash
   # In a new terminal, from First_Project directory
   ng serve
   ```
   The application will be available at `http://localhost:4200`

### Production Build

```bash
cd First_Project
ng build --configuration production
```

The build artifacts will be stored in the `dist/` directory.

## 📊 API Endpoints

### Financial Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/financials` | Get all financial records |
| GET | `/api/financials/:id` | Get specific financial record |
| POST | `/api/financials` | Create new financial record |
| PUT | `/api/financials/:id` | Update financial record |
| DELETE | `/api/financials/:id` | Delete financial record |
| GET | `/api/financials/reports/revenue` | Get revenue report |
| GET | `/api/financials/reports/profit-loss` | Get P&L statement |
| GET | `/api/financials/analytics/sales` | Get sales analytics |
| POST | `/api/financials/export` | Export financial data |

## 🎨 Features in Detail

### Financial Dashboard
- Interactive charts using modern visualization libraries
- Real-time data updates
- Customizable date range filters
- Export functionality for reports
- Responsive design for mobile and desktop

### Revenue Tracking
- Multiple revenue stream categorization
- Monthly, quarterly, and annual views
- Trend analysis and forecasting
- Comparison with previous periods

### Tax Management
- Automated tax calculations
- Support for multiple tax brackets
- Tax liability tracking
- Compliance reporting

## 🔒 Security Features

- Input validation and sanitization
- MongoDB injection prevention
- CORS configuration
- Error handling and logging
- Secure API endpoints

## 🧪 Testing

```bash
# Run unit tests
ng test

# Run end-to-end tests
ng e2e
```

## 📝 Development Guidelines

### Code Style
- Follow Angular style guide
- Use TypeScript strict mode
- Implement proper error handling
- Write meaningful commit messages

### Git Workflow
- Create feature branches from `main`
- Use descriptive branch names (e.g., `feature/financial-export`)
- Submit pull requests for review
- Keep commits atomic and well-documented

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Authors

- **BuddhikaBICT-UoR-FoT-6** - *Initial work and development*

## 🙏 Acknowledgments

- Angular team for the excellent framework
- Express.js community
- MongoDB documentation and community
- All contributors and testers

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

## 🗺️ Roadmap

### Upcoming Features
- [ ] Multi-currency support
- [ ] Advanced analytics with AI insights
- [ ] Mobile application (iOS/Android)
- [ ] Integration with accounting software
- [ ] Automated invoice generation
- [ ] Payment gateway integration
- [ ] Multi-user collaboration features
- [ ] Advanced reporting with custom templates

## 📈 Version History

- **v1.0.0** (February 2026)
  - Initial release
  - Financial management module
  - Admin dashboard
  - Backend API implementation
  - Revenue and P&L reporting

---

**Built with ❤️ using Angular and Node.js**
