"use client";
import { Sparkles, ArrowRight, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import { useEffect, useState } from "react";

export default function ExploreOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOffers() {
      try {
        setLoading(true);
        const res = await fetch("/api/buyer/offers", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load offers");
        setOffers(data.offers || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadOffers();
  }, []);

  const featuredOffer = offers.length > 0 ? offers[0] : null;
  const activeOffers = offers.length > 1 ? offers.slice(1) : offers; // Just to distribute them

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <AppSidebar mode="buyer" />
      <Topbar />
      
      <main className="pl-[260px] pt-[72px] mx-auto p-8 max-w-[1400px]">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Offers</h1>
          <div className="mt-2 flex items-center gap-2 text-slate-600">
             <Sparkles size={16} className="text-violet-600" />
             <p>Personalized deals selected by your shopping agent.</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 size={32} className="animate-spin text-violet-600" />
          </div>
        ) : (
          <>
            {/* Featured Campaign */}
            {featuredOffer && (
              <section className="mb-12 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col md:flex-row">
                <div className="p-10 md:w-1/2 flex flex-col justify-center">
                   <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                      <Sparkles size={12} />
                      Featured Campaign
                   </div>
                   <h2 className="text-3xl font-bold text-slate-900 mb-3">{featuredOffer.campaignName}</h2>
                   <p className="text-slate-600 mb-8 max-w-md leading-relaxed">
                     {featuredOffer.description || "Upgrade your setup with AI-curated electronics. Ends in 2 days."}
                   </p>
                   <div className="mb-8 flex items-baseline gap-2 text-violet-700">
                      {featuredOffer.discountPercent > 0 ? (
                        <>
                          <span className="text-5xl font-bold tracking-tight">{featuredOffer.discountPercent}%</span>
                          <span className="text-xl font-bold tracking-tight">OFF</span>
                        </>
                      ) : (
                        <span className="text-3xl font-bold tracking-tight">{featuredOffer.type}</span>
                      )}
                   </div>
                   <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Merchant Partner</p>
                        <p className="font-bold text-slate-900">{featuredOffer.merchant?.name || "Partner Network"}</p>
                      </div>
                      <button className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700">
                        Shop Offer
                      </button>
                   </div>
                </div>
                <div className="md:w-1/2 bg-slate-100 relative min-h-[300px]">
                   <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover" alt="Featured campaign" />
                </div>
              </section>
            )}

            {/* All Active Offers */}
            {activeOffers.length > 0 ? (
              <section>
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">All Active Offers</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-slate-500">Sort by:</span>
                    <button className="flex items-center gap-1 font-semibold text-violet-700">
                       Relevance <ChevronDown size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {activeOffers.map((offer, idx) => (
                    <div key={offer.campaignId} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md flex flex-col">
                      <div className="relative aspect-video bg-slate-100">
                         {offer.discountPercent > 0 && (
                           <div className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-bold text-slate-900 backdrop-blur-sm z-10">
                             {offer.discountPercent}% OFF
                           </div>
                         )}
                         <img src={`https://images.unsplash.com/photo-${1589003071595 + idx}?q=80&w=400&auto=format&fit=crop`} className="absolute inset-0 h-full w-full object-cover" alt={offer.campaignName} />
                      </div>
                      <div className="p-5 flex flex-col flex-1">
                         <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                           <Sparkles size={12} className="text-violet-600" />
                           {offer.merchant?.name || "Merchant"}
                         </div>
                         <h3 className="mb-1 text-lg font-bold text-slate-900 line-clamp-1">{offer.campaignName}</h3>
                         <p className="mb-5 text-sm text-slate-600 line-clamp-2 flex-1">{offer.description || `Special promotion for ${offer.merchant?.name} products.`}</p>
                         <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                           <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{offer.products?.length || 0} products</span>
                           <button className="flex items-center gap-1 text-sm font-bold text-violet-600 hover:text-violet-700">
                             Shop now <ArrowRight size={14} />
                           </button>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              !featuredOffer && (
                <div className="text-center p-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
                   No active offers found right now. Check back later!
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}
