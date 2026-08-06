#import <CoreLocation/CoreLocation.h>
#import <React/RCTBridgeModule.h>

@interface DuGeocoder : NSObject <RCTBridgeModule>
@end

@implementation DuGeocoder

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)resultForPlacemark:(CLPlacemark *)placemark
{
  NSString *city = placemark.locality ?: placemark.subAdministrativeArea
    ?: placemark.administrativeArea;
  if (!city.length) {
    return nil;
  }
  NSString *detail = placemark.subLocality ?: placemark.thoroughfare
    ?: placemark.name ?: city;
  return @{
    @"city": city,
    @"locality": placemark.locality ?: @"",
    @"subAdministrativeArea": placemark.subAdministrativeArea ?: @"",
    @"administrativeArea": placemark.administrativeArea ?: @"",
    @"district": placemark.subLocality ?: @"",
    @"region": placemark.administrativeArea ?: @"",
    @"countryCode": placemark.ISOcountryCode ?: @"",
    @"detail": detail ?: city,
  };
}

RCT_REMAP_METHOD(
  geocodeAddress,
  geocodeAddress:(NSString *)query
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  CLGeocoder *geocoder = [CLGeocoder new];
  [geocoder geocodeAddressString:query
               completionHandler:^(NSArray<CLPlacemark *> *placemarks,
                                   NSError *error) {
    if (error) {
      reject(@"GEOCODE_FAILED", @"暂时无法识别这个地点", error);
      return;
    }
    resolve([self resultForPlacemark:placemarks.firstObject]);
  }];
}

RCT_REMAP_METHOD(
  reverseGeocode,
  reverseGeocode:(double)latitude
  longitude:(double)longitude
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)
{
  CLLocation *location =
    [[CLLocation alloc] initWithLatitude:latitude longitude:longitude];
  CLGeocoder *geocoder = [CLGeocoder new];
  [geocoder reverseGeocodeLocation:location
                completionHandler:^(NSArray<CLPlacemark *> *placemarks,
                                    NSError *error) {
    if (error) {
      reject(@"REVERSE_GEOCODE_FAILED", @"暂时无法读取所在城市", error);
      return;
    }
    resolve([self resultForPlacemark:placemarks.firstObject]);
  }];
}

@end
