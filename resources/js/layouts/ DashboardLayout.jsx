export default function DashboardLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-white shadow-md p-4">
        <h2 className="text-xl font-bold mb-4">Pharmacy ERP</h2>
        <nav>
          <ul className="space-y-2">
            <li><a href="#" className="block text-gray-700 hover:text-blue-600">Dashboard</a></li>
            <li><a href="#" className="block text-gray-700 hover:text-blue-600">Inventory</a></li>
            <li><a href="#" className="block text-gray-700 hover:text-blue-600">Sales</a></li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
