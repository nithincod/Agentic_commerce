// "use client";

// import {
//   useEffect,
//   useState,
// } from "react";

// import Link from "next/link";

// import AppSidebar from "@/components/AppSidebar";
// import Topbar from "@/components/Topbar";
// import AgentActivity from "@/components/AgentActivity";

// import {
//   ArrowRight,
//   Bot,
//   CheckCircle2,
//   Loader2,
//   Paperclip,
//   RefreshCw,
//   Send,
//   ShoppingCart,
//   Sparkles,
//   Tag,
//   X,
// } from "lucide-react";

// export default function BuyerPage() {
//   const [input, setInput] =
//     useState("");

//   const [messages, setMessages] =
//     useState([]);

//   /*
//    * Normal active offers loaded
//    * directly from the offers API.
//    */
//   const [offers, setOffers] =
//     useState([]);

//   /*
//    * Structured offer returned by
//    * Buyer Agent -> Revenue Agent A2A.
//    */
//   const [a2aOffer, setA2aOffer] =
//     useState(null);

//   const [cart, setCart] =
//     useState(null);
  
//   const [products, setProducts] = useState([]);

//   const [loadingOffers, setLoadingOffers] =
//     useState(true);

//   const [loadingCart, setLoadingCart] =
//     useState(true);

//   const [processing, setProcessing] =
//     useState(false);

//   const [addingProductId, setAddingProductId] =
//     useState(null);

//   const [error, setError] =
//     useState("");

//   const [offersError, setOffersError] =
//     useState("");

//   const [cartError, setCartError] =
//     useState("");

//   const [activitySteps, setActivitySteps] =
//     useState([]);

//   /*
//    * --------------------------------------------------
//    * LOAD NORMAL ACTIVE OFFERS
//    * --------------------------------------------------
//    */

//   

//   /*
//    * --------------------------------------------------
//    * LOAD CART
//    * --------------------------------------------------
//    */

//   async function loadCart() {
//     try {
//       setLoadingCart(true);
//       setCartError("");

//       const response =
//         await fetch(
//           "/api/cart",
//           {
//             cache: "no-store",
//           }
//         );

//       const data =
//         await response.json();

//       if (!response.ok) {
//         throw new Error(
//           data?.error ||
//             "Unable to load cart"
//         );
//       }

//       setCart(
//         data?.cart ||
//           data
//       );
//     } catch (err) {
//       console.error(
//         "Buyer cart error:",
//         err
//       );

//       setCartError(
//         err?.message ||
//           "Unable to load cart"
//       );
//     } finally {
//       setLoadingCart(false);
//     }
//   }

//   /*
//    * --------------------------------------------------
//    * INITIAL LOAD
//    * --------------------------------------------------
//    */

//   useEffect(() => {
//     loadOffers();
//     loadCart();
//   }, []);

//   /*
//    * --------------------------------------------------
//    * AGENT ACTIVITY
//    * --------------------------------------------------
//    */

//   function updateActivity(
//     status
//   ) {
//     setActivitySteps([
//       {
//         label:
//           "Understanding request",

//         description:
//           "Processing your shopping request",

//         done:
//           status !== "idle",

//         current:
//           status ===
//           "understanding",
//       },

//       {
//         label:
//           "Searching catalog",

//         description:
//           "Checking live product data",

//         done:
//           [
//             "searching",
//             "completed",
//           ].includes(status),

//         current:
//           status ===
//           "searching",
//       },

//       {
//         label:
//           "Checking active offers",

//         description:
//           "Matching available merchant offers",

//         done:
//           status ===
//           "completed",

//         current:
//           status ===
//           "offers",
//       },

//       {
//         label:
//           "Preparing response",

//         description:
//           "Building the shopping recommendation",

//         done:
//           status ===
//           "completed",

//         current:
//           status ===
//           "responding",
//       },

//       {
//         label:
//           "Ready for selection",

//         description:
//           "Choose a product or continue shopping",

//         current:
//           status ===
//           "completed",
//       },
//     ]);
//   }

//   /*
//    * --------------------------------------------------
//    * SEND MESSAGE TO BUYER AGENT
//    * --------------------------------------------------
//    */

//   async function sendMessage(
//     event
//   ) {
//     event?.preventDefault();

//     const message =
//       input.trim();

//     if (
//       !message ||
//       processing
//     ) {
//       return;
//     }

//     setError("");

//     /*
//      * Add user message immediately.
//      */
//     setMessages(
//       (previous) => [
//         ...previous,
//         {
//           id:
//             `${Date.now()}-user`,

//           role:
//             "user",

//           content:
//             message,
//         },
//       ]
//     );

//     setInput("");
//     setProcessing(true);

//     /*
//      * Clear previous A2A offer so that
//      * an old offer isn't displayed for
//      * a new unrelated request.
//      */
//     setA2aOffer(null);

//     try {
//       /*
//        * Step 1
//        */
//       updateActivity(
//         "understanding"
//       );

//       await new Promise(
//         (resolve) =>
//           setTimeout(
//             resolve,
//             150
//           )
//       );

//       /*
//        * Step 2
//        */
//       updateActivity(
//         "searching"
//       );

//       /*
//        * Call Buyer Agent.
//        *
//        * Buyer Agent will:
//        *
//        * Buyer
//        *   ↓
//        * Product tools
//        *   ↓
//        * A2A request
//        *   ↓
//        * Revenue Agent
//        *   ↓
//        * Merchant campaign
//        */
//       const response =
//         await fetch(
//           "/api/agent/buyer",
//           {
//             method:
//               "POST",

//             headers: {
//               "Content-Type":
//                 "application/json",
//             },

//             body:
//               JSON.stringify({
//                 message,
//               }),
//           }
//         );

//       const data =
//         await response.json();

//       if (!response.ok) {
//         throw new Error(
//           data?.error ||
//             "Buyer Agent request failed"
//         );
//       }

//       /*
//        * Save structured A2A response.
//        *
//        * This is what creates the
//        * "Personalized Merchant Offer"
//        * card below the normal offers.
//        */
//       setA2aOffer(
//         data?.a2aOffer ||
//           null
//       );
       
//       setProducts(
//   Array.isArray(data?.products)
//     ? data.products
//     : []
// );
      
//       /*
//        * Preparing response.
//        */
//       updateActivity(
//         "responding"
//       );

//       const assistantMessage =
//         extractAgentResponse(
//           data
//         );

//       /*
//        * Add assistant response.
//        */
//       setMessages(
//         (previous) => [
//           ...previous,
//           {
//             id:
//               `${Date.now()}-assistant`,

//             role:
//               "assistant",

//             content:
//               assistantMessage,
//           },
//         ]
//       );

//       /*
//        * Refresh live backend state.
//        */
//       await loadCart();
//       await loadOffers();

//       /*
//        * Finished.
//        */
//       updateActivity(
//         "completed"
//       );
//     } catch (err) {
//       console.error(
//         "Buyer agent error:",
//         err
//       );

//       setError(
//         err?.message ||
//           "Unable to complete request"
//       );

//       setMessages(
//         (previous) => [
//           ...previous,
//           {
//             id:
//               `${Date.now()}-error`,

//             role:
//               "assistant",

//             content:
//               err?.message ||
//               "Sorry, I couldn't complete that request.",

//             error:
//               true,
//           },
//         ]
//       );

//       updateActivity(
//         "idle"
//       );
//     } finally {
//       setProcessing(false);
//     }
//   }

//   /*
//    * --------------------------------------------------
//    * ADD PRODUCT TO CART
//    * --------------------------------------------------
//    */

//   async function addOfferToCart(
//     product
//   ) {
//     if (
//       !product?.id ||
//       addingProductId
//     ) {
//       return;
//     }

//     try {
//       setAddingProductId(
//         product.id
//       );

//       setError("");

//       const response =
//         await fetch(
//           "/api/cart/create",
//           {
//             method:
//               "POST",

//             headers: {
//               "Content-Type":
//                 "application/json",
//             },

//             body:
//               JSON.stringify({
//                 productId:
//                   product.id,

//                 quantity:
//                   1,
//               }),
//           }
//         );

//       const data =
//         await response.json();

//       if (!response.ok) {
//         throw new Error(
//           data?.error ||
//             "Unable to add product to cart"
//         );
//       }

//       /*
//        * Show confirmation inside chat.
//        */
//       setMessages(
//         (previous) => [
//           ...previous,
//           {
//             id:
//               `${Date.now()}-cart`,

//             role:
//               "assistant",

//             content:
//               `${product.name} has been added to your cart.`,

//             success:
//               true,
//           },
//         ]
//       );

//       /*
//        * Refresh cart.
//        */
//       await loadCart();
//     } catch (err) {
//       console.error(
//         "Add to cart error:",
//         err
//       );

//       setError(
//         err?.message ||
//           "Unable to add product to cart"
//       );
//     } finally {
//       setAddingProductId(
//         null
//       );
//     }
//   }

//   /*
//    * --------------------------------------------------
//    * REFRESH
//    * --------------------------------------------------
//    */



//   const cartCount =
//     getCartCount(cart);

//   const cartTotal =
//     getCartTotal(cart);

//   /*
//    * --------------------------------------------------
//    * RENDER
//    * --------------------------------------------------
//    */

//   return (
//     <div className="min-h-screen bg-[#f7f8fc]">
//       <AppSidebar
//         mode="buyer"
//       />

//       <Topbar />

//       <main className="ml-[260px] min-h-screen pt-[84px]">
//         <div className="grid min-h-[calc(100vh-84px)] grid-cols-[minmax(0,1fr)_380px]">

//           {/* =========================================
//               MAIN CONTENT
//           ========================================= */}

//           <section className="px-8 py-8">

//             {/* HEADER */}

//             <div className="mb-6 flex items-start justify-between">
//               <div className="flex items-center gap-3">

//                 <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100">
//                   <Sparkles
//                     size={21}
//                     className="text-violet-600"
//                   />
//                 </div>

//                 <div>
//                   <h1 className="text-xl font-semibold text-slate-900">
//                     AI Shopping Assistant
//                   </h1>

//                   <p className="text-sm text-slate-500">
//                     Your agent searches and acts on live commerce data.
//                   </p>
//                 </div>

//               </div>

//               
//             </div>

//             {/* ERROR */}

//             {error && (
//               <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
//                 <X
//                   size={18}
//                   className="mt-0.5 shrink-0 text-red-600"
//                 />

//                 <div className="text-sm text-red-700">
//                   {error}
//                 </div>
//               </div>
//             )}

//             {/* =========================================
//                 NORMAL ACTIVE MERCHANT OFFERS
//             ========================================= */}

            

//             {/* LOADING OFFERS */}

//             {loadingOffers && (
//               <section className="mb-6 rounded-2xl border border-violet-100 bg-white p-6">
//                 <div className="flex items-center gap-3 text-sm text-slate-500">
//                   <Loader2
//                     size={18}
//                     className="animate-spin text-violet-600"
//                   />

//                   Checking active merchant offers...
//                 </div>
//               </section>
//             )}

//             {/* NO OFFERS */}

//             {!loadingOffers &&
//               offers.length ===
//                 0 &&
//               !offersError && (
//                 <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6">
//                   <div className="flex items-center gap-3">

//                     <Tag
//                       size={19}
//                       className="text-slate-400"
//                     />

//                     <div>
//                       <div className="text-sm font-semibold text-slate-700">
//                         No active offers right now
//                       </div>

//                       <div className="mt-1 text-xs text-slate-400">
//                         Your assistant will continue using the live catalog.
//                       </div>
//                     </div>

//                   </div>
//                 </section>
//               )}

//             {/* =========================================
//                 A2A PERSONALIZED OFFER
//             ========================================= */}

//             {a2aOffer?.success &&
//               a2aOffer?.responses?.some(
//                 (response) =>
//                   Array.isArray(
//                     response?.offers
//                   ) &&
//                   response.offers.length >
//                     0
//               ) && (
//                 <section className="mb-6">

//                   <div className="mb-4">

//                     <div className="flex items-center gap-2">

//                       <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100">
//                         <Sparkles
//                           size={17}
//                           className="text-violet-600"
//                         />
//                       </div>

//                       <div>
//                         <h2 className="text-lg font-semibold text-slate-900">
//                           Personalized Merchant Offer
//                         </h2>

//                         <p className="mt-1 text-sm text-slate-500">
//                           Your Buyer Agent checked with a merchant Revenue Agent.
//                         </p>
//                       </div>

//                     </div>

//                   </div>

//                   <div className="space-y-4">

//                     {a2aOffer.responses.map(
//                       (
//                         response
//                       ) =>
//                         Array.isArray(
//                           response?.offers
//                         )
//                           ? response.offers.map(
//                               (
//                                 offer
//                               ) => (
//                                 <A2AOfferCard
//                                   key={
//                                     `${response.merchantId}-${offer.campaignId}`
//                                   }
//                                   offer={
//                                     offer
//                                   }
//                                   addingProductId={
//                                     addingProductId
//                                   }
//                                   onAdd={
//                                     addOfferToCart
//                                   }
//                                 />
//                               )
//                             )
//                           : null
//                     )}

//                   </div>

//                 </section>
//               )}

//               {/* AGENT PRODUCT RESULTS */}
// {products.length > 0 && (
//   <section className="mb-6">
//     <div className="mb-4">
//       <h2 className="text-lg font-semibold text-slate-900">
//         Products Found
//       </h2>

//       <p className="mt-1 text-sm text-slate-500">
//         Products returned from the live catalog.
//       </p>
//     </div>

//     <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
//       {products.map((product, index) => (
//         <ProductCard
//           key={product.id}
//           product={product}
//           recommended={index === 0}
//           loading={
//             addingProductId === product.id
//           }
//           onAddToCart={addOfferToCart}
//         />
//       ))}
//     </div>
//   </section>
// )}

//             {/* =========================================
//                 CHAT
//             ========================================= */}

//             {messages.length ===
//             0 ? (
//               <div className="mb-8 rounded-2xl border border-dashed border-violet-200 bg-white px-6 py-16 text-center">

//                 <ShoppingCart
//                   size={30}
//                   className="mx-auto text-violet-500"
//                 />

//                 <h2 className="mt-4 text-sm font-semibold text-slate-900">
//                   Start with a shopping request
//                 </h2>

//                 <p className="mt-1 text-sm text-slate-500">
//                   Product information comes from your live catalog.
//                 </p>

//               </div>
//             ) : (
//               <div className="mb-8 space-y-4">

//                 {messages.map(
//                   (
//                     message
//                   ) => (
//                     <ChatBubble
//                       key={
//                         message.id
//                       }
//                       message={
//                         message
//                       }
//                     />
//                   )
//                 )}

//               </div>
//             )}

//             {/* =========================================
//                 INPUT
//             ========================================= */}

//             <form
//               onSubmit={
//                 sendMessage
//               }
//               className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
//             >

//               <div className="flex items-center gap-2">

//                 <button
//                   type="button"
//                   className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50"
//                   title="Attachments are not enabled yet"
//                 >
//                   <Paperclip
//                     size={19}
//                   />
//                 </button>

//                 <input
//                   value={
//                     input
//                   }
//                   onChange={(
//                     event
//                   ) =>
//                     setInput(
//                       event.target
//                         .value
//                     )
//                   }
//                   placeholder="Type your request..."
//                   disabled={
//                     processing
//                   }
//                   className="flex-1 bg-transparent px-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
//                 />

//                 <button
//                   type="submit"
//                   disabled={
//                     processing ||
//                     !input.trim()
//                   }
//                   className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
//                 >
//                   {processing ? (
//                     <Loader2
//                       size={18}
//                       className="animate-spin"
//                     />
//                   ) : (
//                     <Send
//                       size={18}
//                     />
//                   )}
//                 </button>

//               </div>

//             </form>

//             {/* =========================================
//                 QUICK PROMPTS
//             ========================================= */}

//             <div className="mt-4 flex flex-wrap gap-2">

//               {[
//                 "Find me wireless headphones under ₹3000",
//                 "Show me gaming keyboards under ₹5000",
//                 "Find a lightweight laptop under ₹60000",
//               ].map(
//                 (
//                   prompt
//                 ) => (
//                   <button
//                     key={
//                       prompt
//                     }
//                     type="button"
//                     onClick={() =>
//                       setInput(
//                         prompt
//                       )
//                     }
//                     className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-medium text-violet-600 hover:bg-violet-50"
//                   >
//                     {prompt}
//                   </button>
//                 )
//               )}

//             </div>

//             {/* CART LINK */}

//             <div className="mt-5">

//               <Link
//                 href="/cart"
//                 className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700"
//               >
//                 Open your live cart

//                 {cartCount >
//                   0 && (
//                   <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs">
//                     {cartCount}
//                   </span>
//                 )}

//                 <ArrowRight
//                   size={15}
//                 />
//               </Link>

//             </div>

//           </section>

//           {/* =========================================
//               RIGHT SIDEBAR
//           ========================================= */}

//           <aside className="space-y-5 border-l border-slate-200 bg-[#fbfbfd] px-5 py-6">

//             <AgentActivity
//               steps={
//                 activitySteps
//               }
//             />

//             {/* LIVE CART */}

//             <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

//               <div className="mb-4 flex items-center justify-between">

//                 <div className="flex items-center gap-2">

//                   <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100">

//                     <ShoppingCart
//                       size={16}
//                       className="text-violet-600"
//                     />

//                   </div>

//                   <div>

//                     <div className="font-semibold text-slate-900">
//                       Live Cart
//                     </div>

//                     <div className="text-xs text-slate-500">
//                       Synced from backend
//                     </div>

//                   </div>

//                 </div>

//                 {cartCount >
//                   0 && (
//                   <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
//                     {cartCount}
//                   </span>
//                 )}

//               </div>

//               {loadingCart ? (
//                 <div className="flex items-center gap-2 py-4 text-xs text-slate-500">

//                   <Loader2
//                     size={14}
//                     className="animate-spin"
//                   />

//                   Loading cart...

//                 </div>
//               ) : cartError ? (
//                 <div className="text-xs text-red-600">
//                   {cartError}
//                 </div>
//               ) : cartCount ===
//                 0 ? (
//                 <div className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">
//                   Your cart is empty.
//                 </div>
//               ) : (
//                 <div className="space-y-3">

//                   <div className="text-sm font-semibold text-slate-900">
//                     {cartCount}{" "}
//                     {cartCount ===
//                     1
//                       ? "item"
//                       : "items"}
//                   </div>

//                   <div className="flex items-center justify-between border-t border-slate-100 pt-3">

//                     <span className="text-xs text-slate-500">
//                       Cart total
//                     </span>

//                     <span className="font-semibold text-slate-900">
//                       ₹
//                       {cartTotal.toLocaleString(
//                         "en-IN"
//                       )}
//                     </span>

//                   </div>

//                   <Link
//                     href="/cart"
//                     className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-xs font-semibold text-white hover:bg-violet-700"
//                   >
//                     View Cart

//                     <ArrowRight
//                       size={14}
//                     />
//                   </Link>

//                 </div>
//               )}

//             </section>

//             {/* AGENT STATUS */}

//             <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

//               <div className="mb-4 flex items-center gap-2">

//                 <Bot
//                   size={17}
//                   className="text-violet-600"
//                 />

//                 <div className="font-semibold text-slate-900">
//                   Agent Status
//                 </div>

//               </div>

//               <div className="flex items-center gap-2 text-sm">

//                 <span className="h-2 w-2 rounded-full bg-emerald-500" />

//                 <span className="font-medium text-emerald-600">
//                   {processing
//                     ? "Working"
//                     : "Active"}
//                 </span>

//               </div>

//               <p className="mt-2 text-xs leading-5 text-slate-500">
//                 Buyer decisions and cart actions use authenticated backend data.
//               </p>

//             </section>

//           </aside>

//         </div>
//       </main>
//     </div>
//   );
// }

// /* ==================================================
//    A2A OFFER CARD
//    ================================================== */

// function A2AOfferCard({
//   offer,
//   addingProductId,
//   onAdd,
// }) {
//   return (
//     <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white p-5 shadow-sm">

//       {/* HEADER */}

//       <div className="flex items-start justify-between gap-4">

//         <div className="min-w-0">

//           <div className="flex flex-wrap items-center gap-2">

//             <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">

//               <Sparkles
//                 size={11}
//               />

//               A2A Personalized Offer

//             </span>

//             {offer.merchant?.name && (
//               <span className="text-xs text-slate-500">
//                 from{" "}
//                 {offer.merchant.name}
//               </span>
//             )}

//           </div>

//           <h2 className="mt-3 text-base font-semibold text-slate-900">
//             {offer.campaignName}
//           </h2>

//           {offer.description && (
//             <p className="mt-1 text-sm leading-6 text-slate-600">
//               {offer.description}
//             </p>
//           )}

//         </div>

//         <div className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
//           Active
//         </div>

//       </div>

//       {/* PRODUCTS */}

//       <div className="mt-4 space-y-3">

//         {(offer.products ||
//           []).map(
//           (
//             product
//           ) => (
//             <div
//               key={
//                 product.id
//               }
//               className="flex items-center justify-between gap-4 rounded-xl border border-violet-100 bg-white p-4"
//             >

//               <div className="min-w-0">

//                 <div className="text-sm font-semibold text-slate-900">
//                   {product.name}
//                 </div>

//                 {product.description && (
//                   <div className="mt-1 text-xs leading-5 text-slate-500">
//                     {
//                       product.description
//                     }
//                   </div>
//                 )}

//                 <div className="mt-2 text-xs text-emerald-600">
//                   {product.inventory}{" "}
//                   in stock
//                 </div>

//               </div>

//               <div className="shrink-0 text-right">

//                 <div className="text-lg font-bold text-violet-600">
//                   ₹
//                   {Number(
//                     product.price ||
//                       0
//                   ).toLocaleString(
//                     "en-IN"
//                   )}
//                 </div>

//                 <button
//                   type="button"
//                   disabled={
//                     addingProductId ===
//                     product.id
//                   }
//                   onClick={() =>
//                     onAdd(
//                       product
//                     )
//                   }
//                   className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
//                 >

//                   {addingProductId ===
//                   product.id ? (
//                     <>
//                       <Loader2
//                         size={13}
//                         className="animate-spin"
//                       />

//                       Adding...
//                     </>
//                   ) : (
//                     <>
//                       Add to Cart

//                       <ArrowRight
//                         size={13}
//                       />
//                     </>
//                   )}

//                 </button>

//               </div>

//             </div>
//           )
//         )}

//       </div>

//       {/* A2A FOOTER */}

//       <div className="mt-4 flex items-center gap-2 border-t border-violet-100 pt-3 text-xs text-slate-500">

//         <Bot
//           size={14}
//           className="shrink-0 text-violet-500"
//         />

//         This recommendation was evaluated
//         through Agent-to-Agent communication.

//       </div>

//     </div>
//   );
// }

// /* ==================================================
//    NORMAL OFFER CARD
//    ================================================== */

// 

//       <div className="mt-4 space-y-3">

//         {(offer.products ||
//           []).map(
//           (
//             product
//           ) => (
//             <div
//               key={
//                 product.id
//               }
//               className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
//             >

//               <div className="min-w-0">

//                 <div className="text-sm font-semibold text-slate-900">
//                   {product.name}
//                 </div>

//                 {product.description && (
//                   <div className="mt-1 text-xs text-slate-500">
//                     {
//                       product.description
//                     }
//                   </div>
//                 )}

//                 <div className="mt-2 text-xs text-emerald-600">
//                   {product.inventory}{" "}
//                   in stock
//                 </div>

//               </div>

//               <div className="shrink-0 text-right">

//                 <div className="text-lg font-bold text-violet-600">
//                   ₹
//                   {Number(
//                     product.price ||
//                       0
//                   ).toLocaleString(
//                     "en-IN"
//                   )}
//                 </div>

//                 <button
//                   type="button"
//                   disabled={
//                     addingProductId ===
//                     product.id
//                   }
//                   onClick={() =>
//                     onAdd(
//                       product
//                     )
//                   }
//                   className="mt-2 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
//                 >

//                   {addingProductId ===
//                   product.id ? (
//                     <>
//                       <Loader2
//                         size={13}
//                         className="animate-spin"
//                       />

//                       Adding...
//                     </>
//                   ) : (
//                     <>
//                       Add to cart

//                       <ArrowRight
//                         size={13}
//                       />
//                     </>
//                   )}

//                 </button>

//               </div>

//             </div>
//           )
//         )}

//       </div>

//     </div>
//   );
// }

// /* ==================================================
//    CHAT BUBBLE
//    ================================================== */

// function ChatBubble({
//   message,
// }) {
//   const isUser =
//     message.role ===
//     "user";

//   return (
//     <div
//       className={`flex ${
//         isUser
//           ? "justify-end"
//           : "justify-start"
//       }`}
//     >

//       <div
//         className={`max-w-2xl rounded-2xl px-5 py-4 text-sm ${
//           isUser
//             ? "rounded-br-md bg-violet-100 text-slate-800"
//             : message.error
//               ? "border border-red-200 bg-red-50 text-red-700"
//               : message.success
//                 ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
//                 : "bg-white text-slate-700 shadow-sm"
//         }`}
//       >

//         <div className="flex items-start gap-3">

//           {!isUser &&
//             (message.success ? (
//               <CheckCircle2
//                 size={17}
//                 className="mt-0.5 shrink-0 text-emerald-500"
//               />
//             ) : (
//               <Sparkles
//                 size={17}
//                 className="mt-0.5 shrink-0 text-violet-500"
//               />
//             ))}

//           <div className="whitespace-pre-wrap leading-6">
//             {message.content}
//           </div>

//         </div>

//       </div>

//     </div>
//   );
// }

// /* ==================================================
//    EXTRACT AGENT RESPONSE
//    ================================================== */

// function extractAgentResponse(
//   data
// ) {
//   if (
//     typeof data?.message ===
//     "string"
//   ) {
//     return data.message;
//   }

//   if (
//     typeof data?.response ===
//     "string"
//   ) {
//     return data.response;
//   }

//   if (
//     typeof data?.result ===
//       "string"
//   ) {
//     return data.result;
//   }

//   const messages =
//     data?.result?.messages ||
//     data?.messages;

//   if (
//     Array.isArray(messages)
//   ) {
//     for (
//       let i =
//         messages.length - 1;
//       i >= 0;
//       i--
//     ) {
//       const item =
//         messages[i];

//       if (
//         item?.role ===
//           "assistant" &&
//         typeof item?.content ===
//           "string"
//       ) {
//         return item.content;
//       }
//     }

//     const last =
//       messages[
//         messages.length - 1
//       ];

//     if (
//       typeof last?.content ===
//       "string"
//     ) {
//       return last.content;
//     }
//   }

//   return "I completed the request and updated the live shopping state.";
// }

// /* ==================================================
//    CART COUNT
//    ================================================== */

// function getCartCount(
//   cart
// ) {
//   if (!cart) {
//     return 0;
//   }

//   if (
//     typeof cart.itemCount ===
//     "number"
//   ) {
//     return cart.itemCount;
//   }

//   if (
//     Array.isArray(
//       cart.items
//     )
//   ) {
//     return cart.items.reduce(
//       (
//         sum,
//         item
//       ) =>
//         sum +
//         Number(
//           item.quantity ||
//             0
//         ),
//       0
//     );
//   }

//   return 0;
// }

// /* ==================================================
//    CART TOTAL
//    ================================================== */

// function getCartTotal(
//   cart
// ) {
//   if (!cart) {
//     return 0;
//   }

//   if (
//     typeof cart.total ===
//     "number"
//   ) {
//     return cart.total;
//   }

//   if (
//     typeof cart.totalAmount ===
//     "number"
//   ) {
//     return cart.totalAmount;
//   }

//   if (
//     Array.isArray(
//       cart.items
//     )
//   ) {
//     return cart.items.reduce(
//       (
//         sum,
//         item
//       ) => {
//         const price =
//           Number(
//             item?.price ??
//               item?.product
//                 ?.price ??
//               0
//           );

//         const quantity =
//           Number(
//             item?.quantity ||
//               0
//           );

//         return (
//           sum +
//           price *
//             quantity
//         );
//       },
//       0
//     );
//   }

//   return 0;
// }


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import Topbar from "@/components/Topbar";
import ProductCard from "@/components/ProductCard";
import AgentActivity from "@/components/AgentActivity";

import {
  ArrowRight,
  Loader2,
  Paperclip,
  Send,
  ShoppingCart,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Tag,
} from "lucide-react";


const suggestions = [
  "Find me wireless headphones under ₹3000",
  "Show me gaming keyboards under ₹5000",
  "Find a lightweight laptop under ₹60000",
];


/* ==================================================
   OFFER CARD
   ================================================== */

function OfferCard({
  offer,
  addingProductId,
  onAdd,
}) {
  return (
    <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">
              {offer.type || "OFFER"}
            </span>

            {offer.merchant?.name && (
              <span className="text-xs text-slate-500">
                from {offer.merchant.name}
              </span>
            )}

          </div>

          <h3 className="mt-2 text-base font-semibold text-slate-900">
            {offer.campaignName || "Merchant Offer"}
          </h3>

          {offer.description && (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {offer.description}
            </p>
          )}

        </div>

        <div className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          Active
        </div>

      </div>


      {typeof offer.discountPercent === "number" &&
        offer.discountPercent > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">

            <span className="text-sm font-semibold text-emerald-700">
              {offer.discountPercent}% discount
            </span>

          </div>
        )}


      {Array.isArray(offer.products) &&
        offer.products.length > 0 && (

          <div className="mt-5">

            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Products included
            </p>

            <div className="space-y-3">

              {offer.products.map((product) => {

                const productId =
                  product?.id;

                const isAdding =
                  addingProductId ===
                  productId;

                const inventory =
                  Number(
                    product?.inventory ?? 0
                  );

                return (
                  <div
                    key={productId}
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3"
                  >

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold text-slate-800">
                        {product?.name ||
                          "Product"}
                      </p>

                      {product?.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {product.description}
                        </p>
                      )}

                      <div className="mt-1 flex items-center gap-3">

                        <span className="text-sm font-bold text-slate-900">
                          ₹
                          {Number(
                            product?.price || 0
                          ).toLocaleString(
                            "en-IN"
                          )}
                        </span>

                        {inventory > 0 && (
                          <span className="text-[11px] text-emerald-600">
                            {inventory} available
                          </span>
                        )}

                      </div>

                    </div>


                    <button
                      type="button"
                      onClick={() =>
                        onAdd(product)
                      }
                      disabled={isAdding}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >

                      {isAdding ? (
                        <>
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                          Adding...
                        </>
                      ) : (
                        <>
                          <ShoppingCart
                            size={14}
                          />
                          Add to cart
                        </>
                      )}

                    </button>

                  </div>
                );
              })}

            </div>

          </div>
        )}

    </div>
  );
}


/* ==================================================
   BUYER PAGE
   ================================================== */

export default function BuyerPage() {

  const [input, setInput] =
    useState("");

  const [messages, setMessages] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [cartLoading, setCartLoading] =
    useState("");

  const [error, setError] =
    useState("");

  const [activity, setActivity] =
    useState([]);

  const [offers, setOffers] =
    useState([]);

  const [loadingOffers, setLoadingOffers] =
    useState(false);

  const [offersError, setOffersError] =
    useState("");


  /* ==================================================
     LOAD INITIAL DATA
     ================================================== */

  useEffect(() => {
    loadOffers();
  }, []);


  /* ==================================================
     REFRESH DATA
     ================================================== */

  async function refreshData() {
    await Promise.all([
      loadOffers(),
    ]);
  }


  /* ==================================================
     LOAD OFFERS
     ================================================== */

  async function loadOffers() {
    try {
      setLoadingOffers(true);
      setOffersError("");

      const response =
        await fetch(
          "/api/buyer/offers",
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load offers"
        );
      }

      setOffers(
        Array.isArray(data?.offers)
          ? data.offers
          : []
      );

    } catch (err) {

      console.error(
        "Buyer offers error:",
        err
      );

      setOffersError(
        err?.message ||
          "Unable to load offers"
      );

      setOffers([]);

    } finally {

      setLoadingOffers(false);

    }
  }


  /* ==================================================
     SEND MESSAGE TO BUYER AGENT
     ================================================== */

  async function sendMessage() {

    const message =
      input.trim();

    if (
      !message ||
      loading
    ) {
      return;
    }


    setError("");
    setLoading(true);
    setInput("");
    setProducts([]);


    setActivity([
      {
        label:
          "Understanding request",

        description:
          "Analyzing your requirements",

        done: true,
      },

      {
        label:
          "Searching catalog",

        description:
          "Querying the live product catalog",

        current: true,
      },

      {
        label:
          "Checking inventory",

        description:
          "Verifying availability from the backend",
      },

      {
        label:
          "Ready for selection",

        description:
          "Waiting for the Buyer Agent response",
      },
    ]);


    setMessages(
      (previous) => [
        ...previous,

        {
          role: "user",
          content: message,
        },
      ]
    );


    try {

      const response =
        await fetch(
          "/api/agent/buyer",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              message,
            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Buyer Agent request failed"
        );
      }


      setMessages(
        (previous) => [
          ...previous,

          {
            role: "assistant",

            content:
              data.response ||
              "I completed the request.",
          },
        ]
      );


      const extracted =
        extractProducts(
          data.messages
        );


      setProducts(
        extracted
      );


      setActivity([
        {
          label:
            "Understanding request",

          description:
            "Request understood",

          done: true,
        },

        {
          label:
            "Searching catalog",

          description:
            "Live product results retrieved",

          done: true,
        },

        {
          label:
            "Checking inventory",

          description:
            "Availability verified by the backend",

          done: true,
        },

        {
          label:
            "Ready for selection",

          description:
            `${extracted.length} product result${
              extracted.length === 1
                ? ""
                : "s"
            } returned`,

          current:
            extracted.length > 0,
        },

        {
          label:
            "Add to cart",

          description:
            "Waiting for explicit customer selection",
        },

        {
          label:
            "Create checkout",

          description:
            "Started only after explicit purchase intent",
        },
      ]);

    } catch (err) {

      console.error(
        "Buyer Agent error:",
        err
      );

      setError(
        err?.message ||
          "Unable to contact Buyer Agent"
      );

      setActivity([]);

    } finally {

      setLoading(false);

    }
  }


  /* ==================================================
     EXTRACT PRODUCTS FROM TOOL MESSAGES
     ================================================== */

  function extractProducts(
    rawMessages
  ) {

    const results = [];


    for (
      const message of
        rawMessages || []
    ) {

      let content =
        message?.content;


      if (
        Array.isArray(content)
      ) {

        content =
          content
            .map(
              (item) =>
                typeof item ===
                "string"
                  ? item
                  : item?.text ||
                    ""
            )
            .join("");

      }


      if (
        typeof content !==
        "string"
      ) {
        continue;
      }


      let parsed;

      try {

        parsed =
          JSON.parse(
            content
          );

      } catch {

        continue;

      }


      for (
        const product of
          parsed?.products || []
      ) {

        if (
          product?.id &&
          product?.name &&
          typeof product?.price ===
            "number"
        ) {

          results.push(
            product
          );

        }

      }

    }


    return Array.from(
      new Map(
        results.map(
          (product) => [
            product.id,
            product,
          ]
        )
      ).values()
    );
  }


  /* ==================================================
     ADD PRODUCT TO CART
     ================================================== */

  async function addToCart(
    product
  ) {

    try {

      setCartLoading(
        product.id
      );

      setError("");


      const response =
        await fetch(
          "/api/cart/create",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              productId:
                product.id,

              quantity: 1,
            }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to add product to cart"
        );
      }


      setMessages(
        (previous) => [
          ...previous,

          {
            role:
              "assistant",

            content:
              `${product.name} was added to your cart. Your cart is now ready to review.`,
          },
        ]
      );

    } catch (err) {

      console.error(
        "Add to cart error:",
        err
      );

      setError(
        err?.message ||
          "Unable to add product to cart"
      );

    } finally {

      setCartLoading("");

    }
  }


  /* ==================================================
     ADD OFFER PRODUCT TO CART
     ================================================== */

  async function addOfferToCart(
    product
  ) {

    await addToCart(
      product
    );
  }


  /* ==================================================
     UI
     ================================================== */

  return (
    <div className="min-h-screen bg-[#f7f8fc]">

      <AppSidebar mode="buyer" />

      <Topbar />


      <main className="ml-[260px] pt-[84px]">

        <div className="grid min-h-[calc(100vh-84px)] grid-cols-[minmax(0,1fr)_380px]">

          <section className="px-8 py-8">


            {/* ========================================
               PAGE HEADER
               ======================================== */}

            <div className="mb-8 flex items-start justify-between gap-5">

              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100">

                  <Sparkles
                    size={21}
                    className="text-violet-600"
                  />

                </div>

                <div>

                  <h1 className="text-xl font-semibold text-slate-900">
                    AI Shopping Assistant
                  </h1>

                  <p className="text-sm text-slate-500">
                    Your agent searches and acts on live commerce data.
                  </p>

                </div>

              </div>


              <button
                type="button"
                onClick={
                  refreshData
                }
                disabled={
                  loadingOffers
                }
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >

                <RefreshCw
                  size={15}
                  className={
                    loadingOffers
                      ? "animate-spin"
                      : ""
                  }
                />

                Refresh

              </button>

            </div>


            {/* ========================================
               OFFERS
               ======================================== */}

            <section className="mb-8">

              <div className="mb-4 flex items-center justify-between">

                <div>

                  <h2 className="text-lg font-semibold text-slate-900">
                    Offers for You
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Active offers from live merchant campaigns.
                  </p>

                </div>

                {!loadingOffers &&
                  offers.length > 0 && (
                    <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                      {offers.length} active
                    </div>
                  )}

              </div>


              {/* Loading */}

              {loadingOffers && (
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">

                  <Loader2
                    size={17}
                    className="animate-spin text-violet-600"
                  />

                  Loading active merchant offers...

                </div>
              )}


              {/* Error */}

              {!loadingOffers &&
                offersError && (
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4">

                    <div className="flex items-center gap-3 text-sm text-red-700">

                      <AlertCircle
                        size={18}
                      />

                      {offersError}

                    </div>

                    <button
                      type="button"
                      onClick={
                        loadOffers
                      }
                      className="text-xs font-semibold text-red-700 underline"
                    >
                      Retry
                    </button>

                  </div>
                )}


              {/* No offers */}

              {!loadingOffers &&
                !offersError &&
                offers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">

                    <Tag
                      size={24}
                      className="mx-auto text-slate-400"
                    />

                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      No active offers right now
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Check again later for new merchant campaigns.
                    </p>

                  </div>
                )}


              {/* Offers */}

              {!loadingOffers &&
                offers.length > 0 && (

                  <div className="space-y-4">

                    {offers.map(
                      (offer) => (
                        <OfferCard
                          key={
                            offer.campaignId
                          }
                          offer={
                            offer
                          }
                          addingProductId={
                            cartLoading
                          }
                          onAdd={
                            addOfferToCart
                          }
                        />
                      )
                    )}

                  </div>

                )}

            </section>


            {/* ========================================
               ERROR
               ======================================== */}

            {error && (
              <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

                <AlertCircle
                  size={18}
                />

                <span>
                  {error}
                </span>

              </div>
            )}


            {/* ========================================
               CHAT MESSAGES
               ======================================== */}

            <div className="space-y-4">

              {messages.map(
                (
                  message,
                  index
                ) => (

                  <div
                    key={`${message.role}-${index}`}
                    className={
                      message.role ===
                      "user"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >

                    <div
                      className={
                        message.role ===
                        "user"
                          ? "max-w-xl rounded-2xl rounded-br-md bg-violet-100 px-5 py-4 text-sm text-slate-800"
                          : "max-w-2xl rounded-2xl bg-white px-5 py-4 text-sm leading-6 text-slate-700 shadow-sm"
                      }
                    >

                      <div className="whitespace-pre-wrap">
                        {
                          message.content
                        }
                      </div>

                    </div>

                  </div>

                )
              )}

            </div>


            {/* ========================================
               EMPTY STATE
               ======================================== */}

            {!messages.length && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">

                <ShoppingCart
                  className="mx-auto text-violet-500"
                  size={28}
                />

                <p className="mt-3 text-sm font-semibold text-slate-800">
                  Start with a shopping request
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Product information will come from your live catalog.
                </p>

              </div>
            )}


            {/* ========================================
               LOADING
               ======================================== */}

            {loading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">

                <Loader2
                  size={17}
                  className="animate-spin text-violet-600"
                />

                Buyer Agent is working...

              </div>
            )}


            {/* ========================================
               PRODUCT RESULTS
               ======================================== */}

            {products.length > 0 && (

              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                {products.map(
                  (
                    product,
                    index
                  ) => (

                    <ProductCard
                      key={
                        product.id
                      }
                      product={
                        product
                      }
                      recommended={
                        index === 0
                      }
                      loading={
                        cartLoading ===
                        product.id
                      }
                      onAddToCart={
                        addToCart
                      }
                    />

                  )
                )}

              </div>

            )}


            {/* ========================================
               CHAT INPUT
               ======================================== */}

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50"
                >

                  <Paperclip
                    size={19}
                  />

                </button>


                <input
                  value={
                    input
                  }
                  onChange={
                    (event) =>
                      setInput(
                        event.target.value
                      )
                  }
                  onKeyDown={
                    (event) => {

                      if (
                        event.key ===
                        "Enter"
                      ) {

                        event.preventDefault();

                        sendMessage();

                      }

                    }
                  }
                  placeholder="Type your request..."
                  className="flex-1 bg-transparent px-2 text-sm outline-none"
                  disabled={
                    loading
                  }
                />


                <button
                  type="button"
                  onClick={
                    sendMessage
                  }
                  disabled={
                    loading ||
                    !input.trim()
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                >

                  {loading ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Send
                      size={18}
                    />
                  )}

                </button>

              </div>

            </div>


            {/* ========================================
               SUGGESTIONS
               ======================================== */}

            <div className="mt-4 flex flex-wrap gap-2">

              {suggestions.map(
                (prompt) => (

                  <button
                    key={
                      prompt
                    }
                    type="button"
                    onClick={() =>
                      setInput(
                        prompt
                      )
                    }
                    className="rounded-full border border-violet-200 bg-white px-4 py-2 text-xs font-medium text-violet-600 hover:bg-violet-50"
                  >
                    {prompt}
                  </button>

                )
              )}

            </div>


            {/* ========================================
               CART LINK
               ======================================== */}

            <Link
              href="/cart"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-600"
            >

              Open your live cart

              <ArrowRight
                size={15}
              />

            </Link>

          </section>


          {/* ========================================
             AGENT ACTIVITY SIDEBAR
             ======================================== */}

          <aside className="space-y-5 border-l border-slate-200 bg-[#fbfbfd] px-5 py-6">

            <AgentActivity
              steps={
                activity
              }
            />

          </aside>

        </div>

      </main>

    </div>
  );
}