export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8 flex items-center justify-center">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-lg p-8">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">
          🚀 Tailwind v4 Alpha is Working!
        </h1>
        <p className="text-gray-700 leading-relaxed mb-6">
          This project is now running <span className="font-semibold text-indigo-600">Laravel 12</span> +
          <span className="font-semibold text-blue-600"> React 19</span> + 
          <span className="font-semibold text-pink-600"> Tailwind CSS v4 Alpha</span> with hot reload.
        </p>
        <button className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg shadow-lg hover:shadow-xl hover:scale-105 transform transition-all duration-300 ease-out">
          Test Button
        </button>
      </div>
    </div>
  );
}
