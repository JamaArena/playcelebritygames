export const clampZoom=value=>Math.min(3,Math.max(.65,value));
export function projectPoint(x,y,z,{width,height,scale,angle,pitch}){
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:width/2+(x*c-z*s)*scale,y:height*.59+(x*s+z*c)*scale*pitch-y*scale};
}
export function groundPoint(x,y,{width,height,scale,angle,pitch}){
  const sx=(x-width/2)/scale,sz=(y-height*.59)/(scale*pitch),c=Math.cos(angle),s=Math.sin(angle);
  return {x:sx*c+sz*s,z:-sx*s+sz*c};
}
