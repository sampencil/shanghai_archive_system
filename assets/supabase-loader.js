(async function(){
  const fallback=()=>window.__startShanghaiApp&&window.__startShanghaiApp();
  try{
    const cfg=window.SHANGHAI_SUPABASE;
    if(!cfg||!window.supabase)throw new Error('Supabase client unavailable');
    const client=window.supabase.createClient(cfg.url,cfg.publishableKey);
    const [assetsRes,regionsRes]=await Promise.all([
      client.from('assets').select('*, venue_record:venues(id,name,longitude,latitude)').eq('status','published').order('sort_order'),
      client.from('regions').select('*').order('sort_order')
    ]);
    if(assetsRes.error)throw assetsRes.error;
    if(assetsRes.data?.length){
      window.__SHANGHAI_ASSETS__=assetsRes.data.map(x=>{
        const useVenue=x.use_venue_coordinates!==false;
        const venue=x.venue_record;
        const longitude=useVenue&&venue?venue.longitude:x.longitude;
        const latitude=useVenue&&venue?venue.latitude:x.latitude;
        return {
          id:x.system_id,objectName:x.object_name,image:x.image_url,title:x.exhibition_title,
          venue:venue?.name||x.venue,zone:x.region,dates:`${x.start_date} — ${x.end_date}`,
          longitude:Number(longitude),latitude:Number(latitude),weight:x.exhibition_weight||''
        };
      }).filter(x=>Number.isFinite(x.longitude)&&Number.isFinite(x.latitude));
    }
    if(!regionsRes.error&&regionsRes.data?.length){
      window.__SHANGHAI_REGIONS__=regionsRes.data.map(x=>({
        id:x.id,name:x.name,center:[Number(x.center_longitude),Number(x.center_latitude)],sortOrder:Number(x.sort_order||0)
      }));
    }
  }catch(e){console.warn('[Shanghai Index] Supabase fallback:',e)}
  fallback();
})();
