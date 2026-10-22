export function indiaNotificationClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const value = (type:string) => parts.find(p=>p.type===type)!.value;
  return {day:`${value('year')}-${value('month')}-${value('day')}`,hour:Number(value('hour'))};
}

// Stable per person/day: retries keep the same wording without a paid AI call.
export function notificationCopy(kind:string, userId:string, day:string, fallback:{title:string;body:string}) {
  const choices:Record<string,{title:string;body:string}[]> = {
    profile_match_setup:[
      {title:'Your next crop connection starts here 🌱',body:'Add your crops and location. Help the right farmers and buyers find you.'},
      {title:'Ready to grow your farm network?',body:'A few profile details can open the door to crop matches. Finish yours today.'}],
    profile_completion_crops:[
      {title:'Got crops to offer? Let buyers know 🌾',body:'Add your crops to help people discover what you supply.'},
      {title:'Your crops deserve a spot on CoFarmz',body:'Show buyers what you supply. Add your crop listings to get started.'}],
    profile_completion_equipment:[
      {title:'Have equipment? Put it on the map 🚜',body:'Add your equipment so people can discover your supplier profile.'},
      {title:'Make your equipment easier to discover',body:'Complete your supplier profile with the equipment you offer.'}],
    explore_evening:[
      {title:'Seeds in the soil. Ideas on CoFarmz. 🌱',body:'Explore farming videos and stories from the CoFarmz community.'},
      {title:'Your fields have a story. So do theirs. 🌾',body:'Take a look beyond your farm. Explore farmer stories and agricultural videos.'},
      {title:'Grow crops. Grow connections. 🚜',body:'Spend a moment with your farming community. Tap to explore CoFarmz videos.'},
      {title:'What is growing beyond your farm? 🌱',body:'Explore the people, crops and farming stories shared on CoFarmz.'},
      {title:'A farmer never stops growing 🌾',body:'Make room for a little farm inspiration. Explore agricultural videos on CoFarmz.'},
      {title:'From your field to a wider farm community',body:'Explore farming stories and see what others share on CoFarmz.'},
      {title:'Sow a little curiosity today 🌱',body:'Tap into your farming community and explore agricultural stories and videos.'},
      {title:'Take a tour beyond your fields 🚜',body:'Your next farm break starts here. Explore the CoFarmz video community.'}],
  };
  const variants=choices[kind];
  if(!variants)return fallback;
  let hash=0;for(const char of `${userId}:${day}:${kind}`)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  return variants[hash%variants.length];
}

export function cropMatchCopy(name:string|null,crop:string) {
  return {title:`A ${crop} connection to explore 🌾`,body:`${name || 'Your closest crop partner'} matches your crop interest. Tap to explore their profile and connect.`};
}
