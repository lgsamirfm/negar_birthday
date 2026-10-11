import { useState } from "react";
import Hero from "./Hero";

// A clean sub-component that gracefully handles profile images or letter fallbacks
function UserAvatar({ src, user, gradient }) {
  const [hasError, setHasError] = useState(!src);

  return (
    <div className={`w-11 h-11 bg-gradient-to-tr ${gradient} rounded-full p-[2px] shadow-sm group-hover:scale-105 transition-transform duration-300 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {!hasError ? (
        <img 
          src={src} 
          alt={`${user}'s avatar`}
          className="w-full h-full object-cover rounded-full bg-white"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-bold text-sm text-gray-700 select-none">
          {user.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function App() {
  // Birthday wishes translated to elegant Persian equivalents
  const birthdayWishes = [
    {
      id: 1,
      user: "Lgsamirfm",
      profileImage: "lg.jpg",
      avatarGradient: "from-purple-500 via-pink-500 to-rose-400",
      text: "نگار عزیز، تولدت رو صمیمانه تبریک می‌گم! امیدوارم سال جدید زندگیت پر از خنده‌ها، موفقیت‌های بزرگ و لحظات فراموش‌نشدنی باشه. بهترین‌ها سهم قلب مهربونت."
    },
    { 
      id: 2, 
      user: "Alex_M", 
      profileImage: "https://unsplash.com",
      avatarGradient: "from-emerald-400 to-teal-500", 
      text: "تولدت مبارک نگار جان! آرزو می‌کنم روزت پر از شادی و امسالت یکی از بهترین سال‌های زندگیت باشه. همیشه شاد و درخشان بمانی." 
    },
    { 
      id: 3, 
      user: "Sarah.K", 
      profileImage: "https://unsplash.com",
      avatarGradient: "from-amber-400 to-orange-500", 
      text: "امیدوارم این سال تو رو به تمام آرزوهای قشنگت نزدیک‌تر کنه. تو لایق بهترین‌های این دنیا هستی، تولدت مبارک ستاره پرفروغ!" 
    },
    { 
      id: 4, 
      user: "David_Z", 
      profileImage: "https://unsplash.com",
      avatarGradient: "from-blue-400 to-indigo-500", 
      text: "یک سال دیگه از زندگی زیبات گذشت، به سلامتی سال جدید! مشتاقم که به‌زودی این روز رو در کنار هم جشن بگیریم." 
    },
    { 
      id: 5, 
      user: "Elena_R", 
      profileImage: "", // Letter fallback working example
      avatarGradient: "from-fuchsia-500 to-purple-600", 
      text: "تولدت مبارک! از فرسنگ‌ها دورتر گرم‌ترین آغوش‌ها، انرژی‌های مثبت و عشق بی‌پایانم رو برات می‌فرستم." 
    },
    { 
      id: 6, 
      user: "Tom_W", 
      profileImage: "https://unsplash.com",
      avatarGradient: "from-cyan-400 to-blue-500", 
      text: "تقدیم به یک آدم فوق‌العاده؛ امیدوارم روز تولدت مثل خودت درخشان، الهام‌بخش و بی‌نظیر باشه." 
    }
  ];

  return (
    // "rtl" class forces text alignment and block direction right-to-left for Persian content
    <div className="min-h-screen bg-gradient-to-b from-[#FFFDF9] via-[#FFF5F5] to-[#FFF0FA] antialiased selection:bg-rose-200 selection:text-rose-900 rtl">
      <Hero />

      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {birthdayWishes.map((item) => (
            <div 
              key={item.id} 
              className="group p-6 bg-white/70 backdrop-blur-md border border-rose-100/50 flex flex-col justify-between rounded-3xl shadow-[0_4px_20px_-4px_rgba(244,63,94,0.06)] hover:shadow-[0_10px_30px_-4px_rgba(244,63,94,0.12)] hover:-translate-y-0.5 transition-all duration-300 ease-out text-right"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <UserAvatar 
                    src={item.profileImage} 
                    user={item.user} 
                    gradient={item.avatarGradient} 
                  />
                  <div>
                    <p className="text-gray-800 font-semibold text-sm tracking-tight">{item.user}</p>
                   
                  </div>
                </div>

                {/* Fixed line height for smoother Persian font rendering */}
                <p className="text-gray-600 text-base leading-loose font-normal">
                  {item.text}
                </p>
              </div>

              {/* Flex direction adjusted so the heart emojis align nicely on the left border side */}
              <div className="mt-4 pt-3 border-t border-rose-50/50 flex justify-end ltr">
                <span className="text-rose-300 group-hover:text-rose-400 text-xs transition-colors duration-200">✨ ❤️</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
