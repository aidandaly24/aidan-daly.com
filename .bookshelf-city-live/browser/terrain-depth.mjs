// Centerline depth in the two registered dioramas. The motion clock and real
// surface resolver share these values, including the forward portrait book.
export function routeDepths(layout) {
  return {desk:61,floor:58,toe:16,s1:16,s2:16,s3:16,cross:16,mid:16,east:16,
    pass:28,ledge:layout?116:74,ladder0:137,ladder1:99,upper:27,blocks:16,overlook:16,
    westDock:21,eastDock:23,notebook:layout?188:158,stool:layout?337:137};
}
