package com.duapp

import android.location.Address
import android.location.Geocoder
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale
import kotlin.concurrent.thread

class DuGeocoderModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "DuGeocoder"

  private fun result(address: Address?) =
    address?.let {
      val city = it.locality ?: it.subAdminArea ?: it.adminArea
      if (city.isNullOrBlank()) {
        null
      } else {
        Arguments.createMap().apply {
          putString("city", city)
          putString("locality", it.locality)
          putString("subAdministrativeArea", it.subAdminArea)
          putString("administrativeArea", it.adminArea)
          putString("district", it.subLocality)
          putString("region", it.adminArea)
          putString("countryCode", it.countryCode)
          putString(
            "detail",
            it.featureName ?: it.subLocality ?: it.thoroughfare ?: city,
          )
        }
      }
    }

  @ReactMethod
  fun geocodeAddress(query: String, promise: Promise) {
    thread(name = "du-geocode-address") {
      try {
        @Suppress("DEPRECATION")
        val address =
          Geocoder(reactApplicationContext, Locale.getDefault())
            .getFromLocationName(query, 1)
            ?.firstOrNull()
        promise.resolve(result(address))
      } catch (error: Exception) {
        promise.reject("GEOCODE_FAILED", "暂时无法识别这个地点", error)
      }
    }
  }

  @ReactMethod
  fun reverseGeocode(latitude: Double, longitude: Double, promise: Promise) {
    thread(name = "du-reverse-geocode") {
      try {
        @Suppress("DEPRECATION")
        val address =
          Geocoder(reactApplicationContext, Locale.getDefault())
            .getFromLocation(latitude, longitude, 1)
            ?.firstOrNull()
        promise.resolve(result(address))
      } catch (error: Exception) {
        promise.reject("REVERSE_GEOCODE_FAILED", "暂时无法读取所在城市", error)
      }
    }
  }
}
